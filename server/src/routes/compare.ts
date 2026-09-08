import { Router } from "express";
import {
  CompareRequestSchema,
  CompareResponseSchema,
  LLMCompareOutputSchema,
} from "@thinking-explorer/shared";
import { sessionExists } from "../services/graphService.js";
import { HttpError, validateBody } from "../validation/validate.js";
import { getConcept } from "../db/repositories/concepts.js";
import { listRelationshipsBySession } from "../db/repositories/relationships.js";
import { llmProvider, OpenRouterProvider } from "../services/llm/openrouter.js";
import { buildComparePrompt } from "../services/llm/prompts.js";
import { insertExplorationEvent, insertLLMCall } from "../db/repositories/llmCalls.js";
import {
  LLMConfigurationError,
  LLMUpstreamError,
  LLMValidationError,
} from "../services/llm/provider.js";

export const compareRouter = Router({ mergeParams: true });

compareRouter.post(
  "/",
  validateBody(CompareRequestSchema),
  async (req, res, next) => {
    try {
      const { id: sessionId } = req.params as { id: string };
      const { aNodeId, bNodeId, axes } = req.body as {
        aNodeId: string;
        bNodeId: string;
        axes?: string[];
      };

      if (!sessionExists(sessionId)) {
        throw new HttpError(404, "session_not_found", "Session not found");
      }

      const aConcept = getConcept(aNodeId);
      if (!aConcept || aConcept.sessionId !== sessionId) {
        throw new HttpError(404, "concept_not_found", "Concept A not in session");
      }

      const bConcept = getConcept(bNodeId);
      if (!bConcept || bConcept.sessionId !== sessionId) {
        throw new HttpError(404, "concept_not_found", "Concept B not in session");
      }

      const allEdges = listRelationshipsBySession(sessionId);

      function getRelationshipSummary(conceptId: string) {
        return allEdges
          .filter((e) => e.sourceId === conceptId || e.targetId === conceptId)
          .map((e) => {
            const isSource = e.sourceId === conceptId;
            const otherId = isSource ? e.targetId : e.sourceId;
            const otherConcept = getConcept(otherId);
            return {
              type: e.type,
              kind: e.kind,
              explanation: e.explanation,
              strength: e.strength,
              otherLabel: otherConcept?.label ?? "?",
            };
          });
      }

      const prompt = buildComparePrompt({
        a: {
          label: aConcept.label,
          category: aConcept.category ?? undefined,
          summary: aConcept.summary ?? undefined,
          relationships: getRelationshipSummary(aConcept.id),
        },
        b: {
          label: bConcept.label,
          category: bConcept.category ?? undefined,
          summary: bConcept.summary ?? undefined,
          relationships: getRelationshipSummary(bConcept.id),
        },
        axes,
      });

      let result;
      try {
        result = await llmProvider.generateJson(prompt, LLMCompareOutputSchema);
      } catch (err) {
        if (err instanceof LLMConfigurationError) {
          throw new HttpError(503, "llm_not_configured", err.message);
        }
        if (err instanceof LLMValidationError) {
          throw new HttpError(502, "llm_invalid_output", err.message, err.issues);
        }
        if (err instanceof LLMUpstreamError) {
          throw new HttpError(502, "llm_upstream_error", err.message, err.body);
        }
        throw err;
      }

      const requestHash =
        llmProvider instanceof OpenRouterProvider ? llmProvider.hashRequest(prompt) : "";
      insertLLMCall({
        sessionId,
        purpose: "compare",
        provider: llmProvider.name,
        model: result.model,
        requestHash,
        response: result.raw,
        durationMs: result.durationMs,
      });
      insertExplorationEvent({
        sessionId,
        type: "compare",
        payload: { aNodeId, bNodeId, axes: axes ?? null },
        resultSummary: `Compared "${aConcept.label}" vs "${bConcept.label}" → ${result.data.axes.length} axes`,
      });

      const body = CompareResponseSchema.parse({
        axes: result.data.axes,
        summary: result.data.summary,
      });
      res.json(body);
    } catch (err) {
      next(err);
    }
  }
);
