import { describe, it, expect } from "vitest";
import { layoutConcepts, arrangeConcepts, edgesFromRelationships } from "./layout.js";
import type { Concept, Relationship } from "@thinking-explorer/shared";

function dummyConcept(id: string, label = `C${id}`): Concept {
  return {
    id,
    sessionId: "s1",
    label,
    category: "",
    summary: "",
    origin: "user",
    createdAt: 0,
    sourceNodeId: null,
  };
}

function dummyRel(sourceId: string, targetId: string): Relationship {
  return {
    id: `${sourceId}-${targetId}`,
    sessionId: "s1",
    sourceId,
    targetId,
    type: "supports",
    kind: "fact",
    style: "curve",
    explanation: "",
    strength: 0.5,
    origin: "user",
    createdAt: 0,
  };
}

describe("layoutConcepts", () => {
  it("returns empty map for empty concepts", () => {
    expect(layoutConcepts([]).size).toBe(0);
  });

  it("places single concept at center (400, 300)", () => {
    const map = layoutConcepts([dummyConcept("1")]);
    expect(map.get("1")).toEqual({ id: "1", x: 400, y: 300 });
  });

  it("places multiple concepts radially in a circle", () => {
    const concepts = [dummyConcept("1"), dummyConcept("2"), dummyConcept("3"), dummyConcept("4")];
    const map = layoutConcepts(concepts);
    expect(map.size).toBe(4);
    for (const c of concepts) {
      const pos = map.get(c.id)!;
      // Distance from center should be ~240
      const dist = Math.hypot(pos.x - 400, pos.y - 300);
      expect(Math.round(dist)).toBe(240);
    }
  });
});

describe("arrangeConcepts", () => {
  it("returns empty map for empty input", () => {
    expect(arrangeConcepts([], []).size).toBe(0);
  });

  it("arranges connected components by BFS levels", () => {
    const c1 = dummyConcept("1");
    const c2 = dummyConcept("2");
    const c3 = dummyConcept("3");
    const rels = [dummyRel("1", "2"), dummyRel("2", "3")];
    const map = arrangeConcepts([c1, c2, c3], rels);

    expect(map.size).toBe(3);
    expect(map.has("1")).toBe(true);
    expect(map.has("2")).toBe(true);
    expect(map.has("3")).toBe(true);
  });

  it("handles multiple disconnected components", () => {
    const comp1 = [dummyConcept("1"), dummyConcept("2")];
    const comp2 = [dummyConcept("3"), dummyConcept("4")];
    const rels = [dummyRel("1", "2"), dummyRel("3", "4")];
    const map = arrangeConcepts([...comp1, ...comp2], rels);

    expect(map.size).toBe(4);
    // Component 2 should be shifted right from component 1
    const x1 = map.get("1")!.x;
    const x3 = map.get("3")!.x;
    expect(x3).toBeGreaterThan(x1);
  });
});

describe("edgesFromRelationships", () => {
  it("maps relationships to ReactFlow edge shapes", () => {
    const rel = dummyRel("1", "2");
    const edges = edgesFromRelationships([rel]);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual({
      id: "1-2",
      source: "1",
      target: "2",
      data: { rel },
    });
  });
});