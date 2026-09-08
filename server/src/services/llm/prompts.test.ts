import { describe, it, expect } from "vitest";
import {
  buildExpandPrompt,
  buildConceptDetailsPrompt,
  buildConceptQAPrompt,
  buildConnectPrompt,
  buildChallengePrompt,
  buildComparePrompt,
} from "./prompts.js";
import type { Concept, Relationship } from "@thinking-explorer/shared";

function dummyConcept(id: string, label: string): Concept {
  return {
    id,
    sessionId: "s1",
    label,
    origin: "user",
    createdAt: 0,
    category: "",
    summary: "",
    sourceNodeId: null,
  };
}

describe("prompts", () => {
  describe("buildExpandPrompt", () => {
    it("serializes a seed with no neighbors", () => {
      const seed = dummyConcept("1", "Seed A");
      seed.category = "test_cat";
      const req = buildExpandPrompt({
        seed,
        neighbors: [],
        neighborhoodEdges: [],
        depth: 1,
      });
      expect(req.purpose).toBe("expand");
      expect(req.user).toContain("Seed A");
      expect(req.user).toContain("test_cat");
      expect(req.user).toContain("brand-new concept");
      expect(req.user).not.toContain("Known relationships");
    });

    it("serializes a seed with neighbors and edges", () => {
      const seed = dummyConcept("1", "Seed A");
      const neighbor = dummyConcept("2", "Neighbor B");
      const edge: Relationship = {
        id: "e1",
        sessionId: "s1",
        sourceId: "1",
        targetId: "2",
        type: "supports",
        kind: "fact",
        strength: 0.8,
        explanation: "Because",
        origin: "user",
        createdAt: 0,
      };
      const req = buildExpandPrompt({
        seed,
        neighbors: [neighbor],
        neighborhoodEdges: [edge],
        depth: 2,
        focus: "the focus",
      });
      expect(req.user).toContain("Focus: the focus");
      expect(req.user).toContain("Neighbor B");
      expect(req.user).toContain("seed -[supports/fact");
      expect(req.user).toContain("Because");
    });
  });

  describe("buildConceptDetailsPrompt", () => {
    it("builds a details prompt", () => {
      const concept = dummyConcept("1", "Concept A");
      const req = buildConceptDetailsPrompt({
        concept,
        neighbors: [{ label: "Neighbor B", category: "Cat" }],
        relationships: [{ otherLabel: "Neighbor B", type: "part_of", kind: "analogy", explanation: "" }],
      });
      expect(req.purpose).toBe("details");
      expect(req.system).toContain("expert explainer");
      expect(req.user).toContain("Concept A");
      expect(req.user).toContain("Neighbor B");
      expect(req.user).toContain("part_of/analogy");
    });
  });

  describe("buildConceptQAPrompt", () => {
    it("builds a Q&A prompt with context and history", () => {
      const concept = dummyConcept("1", "Concept A");
      concept.summary = "A core concept.";
      const req = buildConceptQAPrompt({
        concept,
        neighbors: [{ label: "Neighbor B" }],
        relationships: [{ otherLabel: "Neighbor B", type: "causes", kind: "fact", explanation: "Causes it" }],
        history: [{ role: "user", text: "What is this?" }, { role: "assistant", text: "It is A." }],
        question: "Can it be both?",
      });
      expect(req.purpose).toBe("qa");
      expect(req.system).toContain("answer follow-up questions");
      expect(req.user).toContain("Subject: Concept A");
      expect(req.user).toContain("Summary: A core concept.");
      expect(req.user).toContain("User: What is this?");
      expect(req.user).toContain("Assistant: It is A.");
      expect(req.user).toContain("Follow-up question: Can it be both?");
    });
  });

  describe("buildConnectPrompt", () => {
    it("builds a connect prompt linking two concepts", () => {
      const req = buildConnectPrompt({
        from: dummyConcept("1", "Concept A"),
        to: dummyConcept("2", "Concept B"),
        fromNeighbors: [],
        toNeighbors: [],
        fromEdges: [],
        toEdges: [],
        maxBridges: 2,
      });
      expect(req.purpose).toBe("connect");
      expect(req.user).toContain("Max bridges: 2");
      expect(req.user).toContain("label: Concept A");
      expect(req.user).toContain("label: Concept B");
    });
  });

  describe("buildChallengePrompt", () => {
    it("builds a challenge prompt for a concept", () => {
      const req = buildChallengePrompt({
        targetKind: "concept",
        targetLabel: "Theory X",
        targetSummary: "It says things.",
        relationships: [],
      });
      expect(req.purpose).toBe("challenge");
      expect(req.user).toContain("label: Theory X");
      expect(req.user).toContain("summary: It says things.");
    });
  });

  describe("buildComparePrompt", () => {
    it("builds a compare prompt for two concepts", () => {
      const req = buildComparePrompt({
        a: { label: "Apple", relationships: [] },
        b: { label: "Orange", relationships: [] },
        axes: ["Color"],
      });
      expect(req.purpose).toBe("compare");
      expect(req.user).toContain("label: Apple");
      expect(req.user).toContain("label: Orange");
      expect(req.user).toContain("Requested axes: Color");
    });
  });
});