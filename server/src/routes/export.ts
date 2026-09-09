import { Router } from "express";
import { z } from "zod";
import { sessionExists } from "../services/graphService.js";
import { HttpError } from "../validation/validate.js";
import { getSession } from "../db/repositories/sessions.js";
import { listConceptsBySession } from "../db/repositories/concepts.js";
import { listRelationshipsBySession } from "../db/repositories/relationships.js";
import { buildExportSummary } from "../db/repositories/export.js";
import { llmProvider } from "../services/llm/openrouter.js";
import { buildExportSummaryPrompt } from "../services/llm/prompts.js";

const LLMExportNarrativeSchema = z.object({
  narrative: z.string(),
});

export const exportRouter = Router({ mergeParams: true });

exportRouter.get("/summary", async (req, res, next) => {
  try {
    const { id: sessionId } = req.params as { id: string };

    if (!sessionExists(sessionId)) {
      throw new HttpError(404, "session_not_found", "Session not found");
    }

    const session = getSession(sessionId);
    const concepts = listConceptsBySession(sessionId);
    const relationships = listRelationshipsBySession(sessionId);

    const generateNarrative = async (context: {
      title: string | null;
      concepts: Array<{ label: string; category?: string; summary?: string; origin: string }>;
      relationships: Array<{ sourceLabel: string; targetLabel: string; type: string; kind: string; explanation?: string }>;
      expandedConceptCount: number;
    }) => {
      try {
        const prompt = buildExportSummaryPrompt(context);
        const result = await llmProvider.generateJson(prompt, LLMExportNarrativeSchema);
        return result.data.narrative;
      } catch (err) {
        console.warn("LLM export summary failed, falling back to template:", err instanceof Error ? err.message : err);
        return null;
      }
    };

    const summary = await buildExportSummary(session!, concepts, relationships, generateNarrative);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});