import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateConceptDetails, askConceptQuestion } from "./concept-details-service.js";
import { api } from "../../api/client.js";
import type { Concept } from "@thinking-explorer/shared";

vi.mock("../../api/client.js", () => ({
  api: {
    getConceptDetails: vi.fn(),
    askConceptQuestion: vi.fn(),
  },
}));

const mockGetConceptDetails = vi.mocked(api.getConceptDetails);
const mockAskConceptQuestion = vi.mocked(api.askConceptQuestion);

describe("concept-details-service", () => {
  const dummyConcept: Concept = {
    id: "concept-1",
    sessionId: "session-1",
    label: "Neural networks",
    category: "AI",
    summary: "Interconnected nodes",
    origin: "user",
    createdAt: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls api.getConceptDetails with sessionId and conceptId", async () => {
    mockGetConceptDetails.mockResolvedValueOnce({
      overview: "Overview text",
      significance: "Why it matters",
      connections: "Connections",
      example: "Example",
    });

    const result = await generateConceptDetails(dummyConcept);
    expect(mockGetConceptDetails).toHaveBeenCalledWith("session-1", "concept-1");
    expect(result.overview).toBe("Overview text");
  });

  it("calls api.askConceptQuestion with question and history", async () => {
    mockAskConceptQuestion.mockResolvedValueOnce({
      answer: "Neural networks are computational models.",
    });

    const result = await askConceptQuestion(
      dummyConcept,
      "How do they train?",
      [{ role: "user", text: "What is this?" }]
    );

    expect(mockAskConceptQuestion).toHaveBeenCalledWith("session-1", "concept-1", {
      question: "How do they train?",
      history: [{ role: "user", text: "What is this?" }],
    });
    expect(result.answer).toBe("Neural networks are computational models.");
  });
});