import { create } from "zustand";
import type {
  Concept,
  Graph,
  Relationship,
  RelationshipType,
  Session,
  ExpandRequest,
  ExpandResponse,
  ConnectRequest,
  ConnectResponse,
  ChallengeRequest,
  ChallengeResponse,
  CompareRequest,
  CompareResponse,
  TrailEvent,
} from "@thinking-explorer/shared";

export interface ExpandMetrics {
  conceptCount: number;
  relationshipCount: number;
  avgStrength: number;
  typeBreakdown: Record<RelationshipType, number>;
}

interface GraphState {
  sessions: Session[];
  currentSessionId: string | null;
  session: Session | null;
  concepts: Concept[];
  relationships: Relationship[];
  positions: Graph["positions"];
  trail: TrailEvent[];
  loading: boolean;
  expandingNodeId: string | null;
  connectingNodeId: string | null;
  lastExpandRequest: ExpandRequest | null;
  error: string | null;
  expandMetrics: ExpandMetrics | null;

  refreshSessions: () => Promise<void>;
  openSession: (id: string) => Promise<void>;
  createSession: (title?: string) => Promise<string>;
  closeSession: () => void;
  removeSession: (id: string) => Promise<void>;
  savePositions: (positions: Graph["positions"]) => Promise<void>;
  updatePosition: (id: string, position: Graph["positions"][string]) => void;
  addConcept: (input: { label: string; category?: string; summary?: string }) => Promise<Concept>;
  addRelationship: (input: {
    sourceId: string;
    targetId: string;
    type: Relationship["type"];
    kind: Relationship["kind"];
    explanation?: string;
    strength?: number;
  }) => Promise<Relationship>;
  expandNode: (req: ExpandRequest) => Promise<ExpandResponse>;
  retryExpand: () => Promise<ExpandResponse>;
  connectNodes: (req: ConnectRequest) => Promise<ConnectResponse>;
  challengeNode: (req: ChallengeRequest) => Promise<ChallengeResponse>;
  dismissExpandMetrics: () => void;
  compareNodes: (req: CompareRequest) => Promise<CompareResponse>;
  loadTrail: () => Promise<void>;
  removeConcept: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  session: null,
  concepts: [],
  relationships: [],
  positions: {},
  trail: [],
  loading: false,
  expandingNodeId: null,
  connectingNodeId: null,
  lastExpandRequest: null,
  error: null,
  expandMetrics: null,

  async refreshSessions() {
    const { api } = await import("../api/client.js");
    const sessions = await api.listSessions();
    set({ sessions });
  },

  async openSession(id) {
    const { api } = await import("../api/client.js");
    window.localStorage.setItem("synapse:last-session", id);
    set({ loading: true, error: null, currentSessionId: id, positions: {} });
    try {
      const graph: Graph = await api.getGraph(id);
      set({
        session: graph.session,
        concepts: graph.concepts,
        relationships: graph.relationships,
        positions: graph.positions,
        loading: false,
      });
      await get().refreshSessions();
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load session",
      });
    }
  },

  async createSession(title) {
    const { api } = await import("../api/client.js");
    const session = await api.createSession(title);
    await get().refreshSessions();
    await get().openSession(session.id);
    return session.id;
  },

  closeSession() {
    window.localStorage.removeItem("synapse:last-session");
    set({
      currentSessionId: null,
      session: null,
      concepts: [],
      relationships: [],
      positions: {},
      trail: [],
      error: null,
      expandingNodeId: null,
      connectingNodeId: null,
      lastExpandRequest: null,
      expandMetrics: null,
    });
  },

  async removeSession(id) {
    const { api } = await import("../api/client.js");
    await api.deleteSession(id);
    set((state) => ({
      sessions: state.sessions.filter((session) => session.id !== id),
      ...(state.currentSessionId === id
        ? {
            currentSessionId: null,
            session: null,
            concepts: [],
            relationships: [],
            positions: {},
            trail: [],
          }
        : {}),
    }));
    if (get().currentSessionId === null) {
      window.localStorage.removeItem("synapse:last-session");
    }
  },

  async savePositions(positions) {
    const sessionId = get().currentSessionId;
    if (!sessionId) return;
    const { api } = await import("../api/client.js");
    await api.savePositions(sessionId, positions);
  },

  updatePosition(id, position) {
    set((state) => ({ positions: { ...state.positions, [id]: position } }));
  },

  async addConcept({ label, category, summary }) {
    const { api } = await import("../api/client.js");
    const sessionId = get().currentSessionId;
    if (!sessionId) throw new Error("No active session");
    const concept = await api.createConcept(sessionId, {
      label,
      category,
      summary,
    });
    set((s) => ({ concepts: [...s.concepts, concept] }));
    return concept;
  },

  async addRelationship({ sourceId, targetId, type, kind, explanation, strength }) {
    const { api } = await import("../api/client.js");
    const sessionId = get().currentSessionId;
    if (!sessionId) throw new Error("No active session");
    const rel = await api.createRelationship(sessionId, {
      sourceId,
      targetId,
      type,
      kind,
      explanation,
      strength,
    });
    set((s) => ({ relationships: [...s.relationships, rel] }));
    return rel;
  },

  async expandNode(req) {
    const { api } = await import("../api/client.js");
    const sessionId = get().currentSessionId;
    if (!sessionId) throw new Error("No active session");
    set({ expandingNodeId: req.nodeId, error: null, lastExpandRequest: req, expandMetrics: null });
    try {
      const result = await api.expand(sessionId, req);
      const typeBreakdown: Record<RelationshipType, number> = {
        supports: 0, contradicts: 0, part_of: 0, analogous_to: 0,
        causes: 0, requires: 0, bridges: 0, related_to: 0,
      };
      for (const r of result.relationships) typeBreakdown[r.type] = (typeBreakdown[r.type] ?? 0) + 1;
      const avgStrength =
        result.relationships.length > 0
          ? result.relationships.reduce((sum, r) => sum + r.strength, 0) / result.relationships.length
          : 0;
      const metrics: ExpandMetrics = {
        conceptCount: result.concepts.length,
        relationshipCount: result.relationships.length,
        avgStrength,
        typeBreakdown,
      };
      set((s) => ({
        concepts: [...s.concepts, ...result.concepts],
        relationships: [...s.relationships, ...result.relationships],
        expandingNodeId: null,
        expandMetrics: metrics,
      }));
      return result;
    } catch (err) {
      set({
        expandingNodeId: null,
        error: err instanceof Error ? err.message : "Expand failed",
      });
      throw err;
    }
  },

  async retryExpand() {
    const request = get().lastExpandRequest;
    if (!request) throw new Error("No expansion to retry");
    return get().expandNode(request);
  },

  async connectNodes(req) {
    const { api } = await import("../api/client.js");
    const sessionId = get().currentSessionId;
    if (!sessionId) throw new Error("No active session");
    set({ connectingNodeId: req.fromNodeId, error: null });
    try {
      const result = await api.connect(sessionId, req);
      const newConcepts = result.bridges.map((b) => b.concept);
      const newRelationships = result.bridges.flatMap((b) => b.relationships);
      set((s) => ({
        concepts: [...s.concepts, ...newConcepts],
        relationships: [...s.relationships, ...newRelationships],
        connectingNodeId: null,
      }));
      return result;
    } catch (err) {
      set({
        connectingNodeId: null,
        error: err instanceof Error ? err.message : "Connect failed",
      });
      throw err;
    }
  },

  async challengeNode(req) {
    const { api } = await import("../api/client.js");
    const sessionId = get().currentSessionId;
    if (!sessionId) throw new Error("No active session");
    return api.challenge(sessionId, req);
  },

  async compareNodes(req) {
    const { api } = await import("../api/client.js");
    const sessionId = get().currentSessionId;
    if (!sessionId) throw new Error("No active session");
    return api.compare(sessionId, req);
  },

  async loadTrail() {
    const { api } = await import("../api/client.js");
    const sessionId = get().currentSessionId;
    if (!sessionId) return;
    const result = await api.getTrail(sessionId);
    set({ trail: result.events });
  },

  async removeConcept(id) {
    const { api } = await import("../api/client.js");
    const sessionId = get().currentSessionId;
    if (!sessionId) throw new Error("No active session");
    await api.deleteConcept(sessionId, id);
    const positions = { ...get().positions };
    delete positions[id];
    set((s) => ({
      concepts: s.concepts.filter((c) => c.id !== id),
      relationships: s.relationships.filter(
        (r) => r.sourceId !== id && r.targetId !== id
      ),
      positions,
    }));
    await get().savePositions(positions);
  },

  clearError() {
    set({ error: null });
  },

  dismissExpandMetrics() {
    set({ expandMetrics: null });
  },
}));