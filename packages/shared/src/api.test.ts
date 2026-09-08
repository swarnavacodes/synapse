import { describe, it, expect } from "vitest";
import {
  ConceptSchema,
  RelationshipSchema,
  GraphSchema,
  SessionSchema,
  ExpandRequestSchema,
  LLMExpandOutputSchema,
  LLMConnectOutputSchema,
} from "./index.js";
import {
  LLMChallengeOutputSchema,
  LLMCompareOutputSchema,
  ChallengeRequestSchema,
  HealthResponseSchema,
  ApiErrorSchema,
  SavePositionsRequestSchema,
  CreateSessionRequestSchema,
  CreateConceptRequestSchema,
  CreateRelationshipRequestSchema,
  ConceptDetailsSchema,
  ConceptQARequestSchema,
  ConceptQAResponseSchema,
  ConceptQAMessageSchema,
  ConnectRequestSchema,
  CompareRequestSchema,
  TrailEventSchema,
} from "./api.js";

const now = 1_700_000_000_000;

function validConcept(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    sessionId: "s1",
    label: "Consciousness",
    category: "philosophy",
    summary: "The state of being aware.",
    origin: "user",
    sourceNodeId: null,
    createdAt: now,
    ...overrides,
  };
}

function validRelationship(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    sessionId: "s1",
    sourceId: "c1",
    targetId: "c2",
    type: "part_of",
    kind: "interpretation",
    explanation: "Because.",
    strength: 0.8,
    origin: "user",
    createdAt: now,
    ...overrides,
  };
}

describe("ConceptSchema", () => {
  it("accepts a valid concept", () => {
    const parsed = ConceptSchema.parse(validConcept());
    expect(parsed.id).toBe("c1");
  });

  it("defaults category and summary when omitted", () => {
    const { category, summary, sourceNodeId, ...noOptional } = validConcept();
    const parsed = ConceptSchema.parse(noOptional);
    expect(parsed.category).toBe("");
    expect(parsed.summary).toBe("");
    expect(parsed.sourceNodeId).toBeUndefined();
  });

  it("rejects an empty label", () => {
    expect(() => ConceptSchema.parse(validConcept({ label: "" }))).toThrow();
  });

  it("rejects a label longer than 200 chars", () => {
    expect(() =>
      ConceptSchema.parse(validConcept({ label: "x".repeat(201) }))
    ).toThrow();
  });

  it("rejects an unknown origin", () => {
    expect(() => ConceptSchema.parse(validConcept({ origin: "robot" }))).toThrow();
  });

  it("rejects a non-integer createdAt", () => {
    expect(() => ConceptSchema.parse(validConcept({ createdAt: 12.5 }))).toThrow();
  });
});

describe("RelationshipSchema", () => {
  it("accepts a valid relationship", () => {
    const parsed = RelationshipSchema.parse(validRelationship());
    expect(parsed.type).toBe("part_of");
  });

  it("defaults explanation when omitted", () => {
    const { explanation, ...noOptional } = validRelationship();
    const parsed = RelationshipSchema.parse(noOptional);
    expect(parsed.explanation).toBe("");
  });

  it("accepts every relationship type", () => {
    for (const type of [
      "supports",
      "contradicts",
      "part_of",
      "analogous_to",
      "causes",
      "requires",
      "bridges",
      "related_to",
    ]) {
      expect(() =>
        RelationshipSchema.parse(validRelationship({ type }))
      ).not.toThrow();
    }
  });

  it("rejects an invalid type and kind", () => {
    expect(() => RelationshipSchema.parse(validRelationship({ type: "boom" }))).toThrow();
    expect(() => RelationshipSchema.parse(validRelationship({ kind: "rumor" }))).toThrow();
  });

  it("clamps strength boundaries (rejects out of range)", () => {
    expect(() => RelationshipSchema.parse(validRelationship({ strength: 1.1 }))).toThrow();
    expect(() => RelationshipSchema.parse(validRelationship({ strength: -0.1 }))).toThrow();
    expect(() => RelationshipSchema.parse(validRelationship({ strength: 0 }))).not.toThrow();
    expect(() => RelationshipSchema.parse(validRelationship({ strength: 1 }))).not.toThrow();
  });
});

describe("SessionSchema + GraphSchema", () => {
  const session = {
    id: "s1",
    title: "My session",
    createdAt: now,
    updatedAt: now,
  };

  it("accepts an optional session title", () => {
    const parsed = SessionSchema.parse({ ...session, title: null });
    expect(parsed.title).toBeNull();
  });

  it("rejects a session with a missing title key", () => {
    const { title, ...noTitle } = session;
    expect(() => SessionSchema.parse(noTitle)).toThrow();
  });

  it("accepts a full graph payload", () => {
    const graph = {
      session,
      concepts: [validConcept()],
      relationships: [validRelationship()],
      positions: { c1: { x: 1, y: 2 } },
      events: [],
    };
    expect(GraphSchema.parse(graph).concepts).toHaveLength(1);
  });

  it("rejects a graph with a missing relationships array", () => {
    const { relationships, ...noRels } = {
      session,
      concepts: [],
      relationships: [],
      positions: {},
      events: [],
    };
    expect(() => GraphSchema.parse(noRels)).toThrow();
  });

  it("rejects a graph with non-numeric positions", () => {
    expect(() =>
      GraphSchema.parse({
        session,
        concepts: [],
        relationships: [],
        positions: { c1: { x: NaN, y: 0 } },
        events: [],
      })
    ).toThrow();
  });
});

describe("ExpandRequestSchema", () => {
  it("defaults depth to 1", () => {
    expect(ExpandRequestSchema.parse({ nodeId: "c1" }).depth).toBe(1);
  });

  it("accepts depth 2 and an optional focus", () => {
    expect(ExpandRequestSchema.parse({ nodeId: "c1", depth: 2, focus: "ethics" }).focus).toBe("ethics");
  });

  it("rejects an unsupported depth", () => {
    expect(() => ExpandRequestSchema.parse({ nodeId: "c1", depth: 3 })).toThrow();
  });

  it("rejects a missing nodeId", () => {
    expect(() => ExpandRequestSchema.parse({})).toThrow();
  });
});

describe("LLM output schemas", () => {
  function expansion(concepts = 3, relationships = 2) {
    return {
      concepts: Array.from({ length: concepts }, (_, i) => ({
        label: `Concept ${i}`,
        category: "philosophy",
        summary: "A thing.",
      })),
      relationships: Array.from({ length: relationships }, (_, i) => ({
        sourceRef: "seed",
        targetRef: `Concept ${i}`,
        type: "related_to",
        kind: "interpretation",
        explanation: "Connects.",
        strength: 0.6,
      })),
    };
  }

  it("accepts a valid LLM expansion", () => {
    const parsed = LLMExpandOutputSchema.parse(expansion());
    expect(parsed.concepts).toHaveLength(3);
  });

  it("rejects an expansion with no concepts", () => {
    expect(() => LLMExpandOutputSchema.parse(expansion(0))).toThrow();
  });

  it("rejects more than 12 concepts", () => {
    expect(() => LLMExpandOutputSchema.parse(expansion(13))).toThrow();
  });

  it("rejects an expansion with an out-of-range strength", () => {
    const wrong = expansion();
    wrong.relationships[0].strength = 1.5;
    expect(() => LLMExpandOutputSchema.parse(wrong)).toThrow();
  });

  it("rejects a relationship referencing an unknown shape (missing type)", () => {
    const wrong = expansion();
    delete wrong.relationships[0].type;
    expect(() => LLMExpandOutputSchema.parse(wrong)).toThrow();
  });

  it("accepts a valid connect output", () => {
    const output = {
      bridges: Array.from({ length: 2 }, (_, i) => ({
        label: `Bridge ${i}`,
        summary: "A bridge.",
        fromRelationship: { type: "supports", kind: "fact", strength: 0.5 },
        toRelationship: { type: "supports", kind: "fact", strength: 0.5 },
      })),
    };
    const parsed = LLMConnectOutputSchema.parse(output);
    expect(parsed.bridges).toHaveLength(2);
  });

  it("rejects a connect output with no bridges", () => {
    expect(() => LLMConnectOutputSchema.parse({ bridges: [] })).toThrow();
  });

  it("rejects a challenge output with fewer than 2 critiques", () => {
    expect(() =>
      LLMChallengeOutputSchema.parse({ critiques: [{ text: "Only one.", severity: "minor", aspect: "logic" }] })
    ).toThrow();
  });

  it("accepts a challenge output with the minimum 2 critiques", () => {
    expect(
      LLMChallengeOutputSchema.parse({
        critiques: [
          { text: "One.", severity: "minor", aspect: "logic" },
          { text: "Two.", severity: "significant", aspect: "evidence" },
        ],
      }).critiques
    ).toHaveLength(2);
  });

  it("rejects a compare output with fewer than 3 axes", () => {
    expect(() =>
      LLMCompareOutputSchema.parse({
        axes: [
          { axis: "A", aValue: "x", bValue: "y" },
          { axis: "B", aValue: "x", bValue: "y" },
        ],
        summary: "Short.",
      })
    ).toThrow();
  });

  it("rejects a compare summary longer than 300 chars", () => {
    expect(() =>
      LLMCompareOutputSchema.parse({
        axes: [
          { axis: "A", aValue: "x", bValue: "y" },
          { axis: "B", aValue: "x", bValue: "y" },
          { axis: "C", aValue: "x", bValue: "y" },
        ],
        summary: "y".repeat(301),
      })
    ).toThrow();
  });
});

describe("ChallengeRequestSchema", () => {
  it("accepts a concept target", () => {
    expect(ChallengeRequestSchema.parse({ target: { kind: "concept", id: "c1" } }).target.kind).toBe("concept");
  });

  it("accepts a relationship target", () => {
    expect(ChallengeRequestSchema.parse({ target: { kind: "relationship", id: "r1" } }).target.kind).toBe("relationship");
  });

  it("rejects an unknown target kind", () => {
    expect(() => ChallengeRequestSchema.parse({ target: { kind: "edge", id: "x" } })).toThrow();
  });
});

describe("API request schemas", () => {
  it("HealthResponseSchema requires ok: true", () => {
    expect(() => HealthResponseSchema.parse({ ok: false, version: "0.1.0", llmConfigured: true })).toThrow();
    expect(HealthResponseSchema.parse({ ok: true, version: "0.1.0", llmConfigured: false }).llmConfigured).toBe(false);
  });

  it("ApiErrorSchema parses a standard error payload", () => {
    const parsed = ApiErrorSchema.parse({
      error: { code: "llm_upstream_error", message: "boom", details: { models: [] } },
    });
    expect(parsed.error.code).toBe("llm_upstream_error");
  });

  it("ApiErrorSchema rejects a payload with no message", () => {
    expect(() => ApiErrorSchema.parse({ error: { code: "x" } })).toThrow();
  });

  it("SavePositionsRequestSchema rejects non-finite coordinates", () => {
    expect(() => SavePositionsRequestSchema.parse({ c1: { x: Infinity, y: 0 } })).toThrow();
  });

  it("CreateSessionRequestSchema accepts an optional title", () => {
    expect(CreateSessionRequestSchema.parse({}).title).toBeUndefined();
    expect(CreateSessionRequestSchema.parse({ title: "Hi" }).title).toBe("Hi");
  });

  it("CreateSessionRequestSchema rejects an overlong title", () => {
    expect(() => CreateSessionRequestSchema.parse({ title: "x".repeat(201) })).toThrow();
  });

  it("CreateConceptRequestSchema requires a non-empty label", () => {
    expect(() => CreateConceptRequestSchema.parse({ label: "" })).toThrow();
  });

  it("CreateRelationshipRequestSchema rejects undefined strength above 1", () => {
    expect(() =>
      CreateRelationshipRequestSchema.parse({
        sourceId: "c1",
        targetId: "c2",
        type: "requires",
        kind: "fact",
        strength: 2,
      })
    ).toThrow();
  });

  it("ConnectRequestSchema clamps maxBridges to 1..5", () => {
    expect(ConnectRequestSchema.parse({ fromNodeId: "a", toNodeId: "b" }).maxBridges).toBe(3);
    expect(() => ConnectRequestSchema.parse({ fromNodeId: "a", toNodeId: "b", maxBridges: 0 })).toThrow();
    expect(() => ConnectRequestSchema.parse({ fromNodeId: "a", toNodeId: "b", maxBridges: 6 })).toThrow();
  });

  it("CompareRequestSchema rejects more than 8 axes", () => {
    expect(() =>
      CompareRequestSchema.parse({ aNodeId: "a", bNodeId: "b", axes: Array.from({ length: 9 }, (_, i) => `axis${i}`) })
    ).toThrow();
  });

  it("ConceptDetailsSchema requires populated fields", () => {
    expect(() =>
      ConceptDetailsSchema.parse({ overview: "", significance: "x", connections: "x", example: "x" })
    ).toThrow();
  });

  it("ConceptQARequestSchema parses valid question and history", () => {
    const parsed = ConceptQARequestSchema.parse({
      question: "What are neural correlates?",
      history: [{ role: "user", text: "Hello" }, { role: "assistant", text: "Hi" }],
    });
    expect(parsed.question).toBe("What are neural correlates?");
    expect(parsed.history).toHaveLength(2);
  });

  it("ConceptQARequestSchema defaults history to empty array", () => {
    const parsed = ConceptQARequestSchema.parse({ question: "Why?" });
    expect(parsed.history).toEqual([]);
  });

  it("ConceptQARequestSchema rejects empty questions", () => {
    expect(() => ConceptQARequestSchema.parse({ question: "" })).toThrow();
  });

  it("ConceptQAResponseSchema requires a non-empty answer", () => {
    expect(() => ConceptQAResponseSchema.parse({ answer: "" })).toThrow();
    expect(ConceptQAResponseSchema.parse({ answer: "This is the answer." }).answer).toBe(
      "This is the answer."
    );
  });

  it("TrailEventSchema accepts a full trail event", () => {
    expect(
      TrailEventSchema.parse({
        id: "e1",
        type: "expand",
        payload: { nodeId: "c1" },
        resultSummary: "Expanded.",
        createdAt: now,
      }).type
    ).toBe("expand");
  });
});