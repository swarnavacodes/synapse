import { describe, it, expect, beforeEach } from "vitest";
import { useGraphStore } from "./graphStore.js";

describe("graphStore session management", () => {
  beforeEach(() => {
    useGraphStore.setState({
      currentSessionId: null,
      session: null,
      concepts: [],
      relationships: [],
      positions: {},
      trail: [],
      error: null,
      expandingNodeId: null,
      connectingNodeId: null,
    });
    window.localStorage.clear();
  });

  it("closes the current session and clears working graph state", () => {
    window.localStorage.setItem("synapse:last-session", "sess-123");
    useGraphStore.setState({
      currentSessionId: "sess-123",
      session: {
        id: "sess-123",
        title: "Test Session",
        createdAt: 100,
        updatedAt: 200,
      },
      concepts: [
        {
          id: "c1",
          sessionId: "sess-123",
          label: "A",
          category: "",
          summary: "",
          origin: "user",
          createdAt: 100,
        },
      ],
      relationships: [
        {
          id: "r1",
          sessionId: "sess-123",
          sourceId: "c1",
          targetId: "c2",
          type: "supports",
          kind: "fact",
          style: "curve",
          strength: 0.5,
          explanation: "",
          origin: "user",
          createdAt: 100,
        },
      ],
      positions: { c1: { x: 10, y: 20 } },
      trail: [
        {
          id: "t1",
          type: "seed",
          payload: {},
          resultSummary: "Seeded",
          createdAt: 100,
        },
      ],
      error: "Some error",
      expandingNodeId: "c1",
    });

    useGraphStore.getState().closeSession();

    const state = useGraphStore.getState();
    expect(state.currentSessionId).toBeNull();
    expect(state.session).toBeNull();
    expect(state.concepts).toEqual([]);
    expect(state.relationships).toEqual([]);
    expect(state.positions).toEqual({});
    expect(state.trail).toEqual([]);
    expect(state.error).toBeNull();
    expect(state.expandingNodeId).toBeNull();
    expect(window.localStorage.getItem("synapse:last-session")).toBeNull();
  });
});