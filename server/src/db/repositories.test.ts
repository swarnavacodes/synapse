import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "./client.js";
import { runMigrations } from "./migrations.js";
import {
  createSession,
  getSession,
  deleteSession,
  touchSession,
  listSessions,
} from "./repositories/sessions.js";
import {
  createConcept,
  getConcept,
  deleteConcept,
  listConceptsBySession,
} from "./repositories/concepts.js";
import {
  createRelationship,
  getRelationship,
  listRelationshipsBySession,
} from "./repositories/relationships.js";
import {
  savePositions,
  listPositionsBySession,
} from "./repositories/positions.js";
import {
  insertLLMCall,
  lookupLLMCall,
  insertExplorationEvent,
  listExplorationEvents,
} from "./repositories/llmCalls.js";

describe("SQLite Repositories", () => {
  let sessionId: string;

  beforeEach(() => {
    runMigrations();
    const session = createSession("Test Session");
    sessionId = session.id;
  });

  afterEach(() => {
    deleteSession(sessionId);
  });

  describe("sessions", () => {
    it("creates, retrieves, touches, and lists sessions", () => {
      const found = getSession(sessionId);
      expect(found?.title).toBe("Test Session");

      const before = found!.updatedAt;
      // Sleep a tiny bit or force a new timestamp
      touchSession(sessionId);
      const after = getSession(sessionId)!;
      expect(after.updatedAt).toBeGreaterThanOrEqual(before);

      const list = listSessions();
      expect(list.some((s) => s.id === sessionId)).toBe(true);
    });

    it("cascades deletion through child concepts and relationships", () => {
      const c1 = createConcept({ sessionId, label: "A" });
      const c2 = createConcept({ sessionId, label: "B" });
      createRelationship({
        sessionId,
        sourceId: c1.id,
        targetId: c2.id,
        type: "part_of",
        kind: "fact",
      });
      savePositions(sessionId, { [c1.id]: { x: 1, y: 2 } });

      deleteSession(sessionId);

      expect(getSession(sessionId)).toBeNull();
      expect(listConceptsBySession(sessionId)).toHaveLength(0);
      expect(listRelationshipsBySession(sessionId)).toHaveLength(0);
      expect(listPositionsBySession(sessionId)).toEqual({});
    });
  });

  describe("concepts", () => {
    it("creates, retrieves, and lists concepts", () => {
      const c = createConcept({
        sessionId,
        label: "Neuroscience",
        category: "science",
        summary: "Study of nerves",
      });
      expect(c.label).toBe("Neuroscience");
      expect(c.origin).toBe("user");

      const fetched = getConcept(c.id);
      expect(fetched?.label).toBe("Neuroscience");

      const list = listConceptsBySession(sessionId);
      expect(list).toHaveLength(1);
    });

    it("cascades deletion from concept to attached relationships and positions", () => {
      const c1 = createConcept({ sessionId, label: "C1" });
      const c2 = createConcept({ sessionId, label: "C2" });
      createRelationship({
        sessionId,
        sourceId: c1.id,
        targetId: c2.id,
        type: "causes",
        kind: "fact",
      });
      savePositions(sessionId, { [c1.id]: { x: 10, y: 20 } });

      deleteConcept(c1.id);

      expect(getConcept(c1.id)).toBeNull();
      expect(listRelationshipsBySession(sessionId)).toHaveLength(0);
      expect(listPositionsBySession(sessionId)).toEqual({});
    });
  });

  describe("relationships", () => {
    it("rejects self-loops", () => {
      const c1 = createConcept({ sessionId, label: "Loop" });
      expect(() =>
        createRelationship({
          sessionId,
          sourceId: c1.id,
          targetId: c1.id,
          type: "supports",
          kind: "fact",
        })
      ).toThrow(/Self-loops/);
    });

    it("clamps out-of-range strength to [0, 1]", () => {
      const c1 = createConcept({ sessionId, label: "A" });
      const c2 = createConcept({ sessionId, label: "B" });
      const r = createRelationship({
        sessionId,
        sourceId: c1.id,
        targetId: c2.id,
        type: "supports",
        kind: "fact",
        strength: 5.0,
      });
      expect(r.strength).toBe(1);
    });

    it("retrieves a relationship by ID", () => {
      const c1 = createConcept({ sessionId, label: "A" });
      const c2 = createConcept({ sessionId, label: "B" });
      const r = createRelationship({
        sessionId,
        sourceId: c1.id,
        targetId: c2.id,
        type: "supports",
        kind: "fact",
      });
      expect(getRelationship(r.id)?.id).toBe(r.id);
    });
  });

  describe("positions", () => {
    it("saves and upserts positions", () => {
      const c1 = createConcept({ sessionId, label: "P1" });
      savePositions(sessionId, { [c1.id]: { x: 10, y: 20 } });
      expect(listPositionsBySession(sessionId)[c1.id]).toEqual({ x: 10, y: 20 });

      savePositions(sessionId, { [c1.id]: { x: 99, y: 100 } });
      expect(listPositionsBySession(sessionId)[c1.id]).toEqual({ x: 99, y: 100 });
    });
  });

  describe("llmCalls and exploration_events", () => {
    it("records and looks up LLM calls by request_hash", () => {
      const hash = "hash_" + Date.now();
      insertLLMCall({
        sessionId,
        purpose: "expand",
        provider: "openrouter",
        model: "m1",
        requestHash: hash,
        response: '{"data":1}',
        durationMs: 42,
      });

      const cached = lookupLLMCall(hash);
      expect(cached).not.toBeNull();
      expect(cached?.model).toBe("m1");
      expect(cached?.response).toBe('{"data":1}');
    });

    it("records and lists exploration events in chronological order", () => {
      insertExplorationEvent({
        sessionId,
        type: "seed",
        payload: { label: "First" },
        resultSummary: "Seeded",
      });
      insertExplorationEvent({
        sessionId,
        type: "expand",
        payload: { depth: 1 },
        resultSummary: "Expanded",
      });

      const events = listExplorationEvents(sessionId);
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[events.length - 2].type).toBe("seed");
      expect(events[events.length - 1].type).toBe("expand");
    });
  });
});