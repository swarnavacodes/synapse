import { Router } from "express";
import {
  ChallengeRequestSchema,
  ChallengeResponseSchema,
  LLMChallengeOutputSchema,
} from "@thinking-explorer/shared";
import { sessionExists } from "../services/graphService.js";
import { HttpError, validateBody } from "../validation/validate.js";
import { getConcept } from "../db/repositories/concepts.js";
import { listRelationshipsBySession, getRelationship } from "../db/repositories/relationships.js";
import { llmProvider, OpenRouterProvider } from "../services/llm/openrouter.js";
import { buildChallengePrompt } from "../services/llm/prompts.js";
import { insertExplorationEvent, insertLLMCall } from "../db/repositories/llmCalls.js";
import {
  LLMConfigurationError,
  LLMUpstreamError,
  LLMValidationError,
} from "../services/llm/provider.js";

export const challengeRouter = Router({ mergeParams: true });

challengeRouter.post(
  "/",
  validateBody(ChallengeRequestSchema),
  async (req, res, next) => {
    try {
      const { id: sessionId } = req.params as { id: string };
      const { target } = req.body as {
        target: { kind: "concept" | "relationship"; id: string };
      };

      if (!sessionExists(sessionId)) {
        throw new HttpError(404, "session_not_found", "Session not found");
      }

      const allEdges = listRelationshipsBySession(sessionId);

      if (target.kind === "concept") {
        const concept = getConcept(target.id);
        if (!concept || concept.sessionId !== sessionId) {
          throw new HttpError(404, "concept_not_found", "Concept not in session");
        }

        const relationships = allEdges
          .filter((e) => e.sourceId === concept.id || e.targetId === concept.id)
          .map((e) => {
            const isSource = e.sourceId === concept.id;
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

        const prompt = buildChallengePrompt({
          targetKind: "concept",
          targetLabel: concept.label,
          targetSummary: concept.summary ?? "",
          category: concept.category ?? undefined,
          relationships,
        });

        let result;
        try {
          result = await llmProvider.generateJson(prompt, LLMChallengeOutputSchema);
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
          purpose: "challenge",
          provider: llmProvider.name,
          model: result.model,
          requestHash,
          response: result.raw,
          durationMs: result.durationMs,
        });
        insertExplorationEvent({
          sessionId,
          type: "challenge",
          payload: { target: { kind: "concept", id: concept.id } },
          resultSummary: `Challenged concept "${concept.label}" → ${result.data.critiques.length} critique(s)`,
        });

        const body = ChallengeResponseSchema.parse({ critiques: result.data.critiques });
        res.json(body);
      } else {
        const relationship = getRelationship(target.id);
        if (!relationship || relationship.sessionId !== sessionId) {
          throw new HttpError(404, "relationship_not_found", "Relationship not in session");
        }

        const sourceConcept = getConcept(relationship.sourceId);
        const targetConcept = getConcept(relationship.targetId);

        const prompt = buildChallengePrompt({
          targetKind: "relationship",
          targetLabel: `${sourceConcept?.label ?? "?"} → ${targetConcept?.label ?? "?"}`,
          targetSummary: relationship.explanation ?? "",
          relationships: [],
        });

        let result;
        try {
          result = await llmProvider.generateJson(prompt, LLMChallengeOutputSchema);
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
          purpose: "challenge",
          provider: llmProvider.name,
          model: result.model,
          requestHash,
          response: result.raw,
          durationMs: result.durationMs,
        });
        insertExplorationEvent({
          sessionId,
          type: "challenge",
          payload: { target: { kind: "relationship", id: relationship.id } },
          resultSummary: `Challenged relationship → ${result.data.critiques.length} critique(s)`,
        });

        const body = ChallengeResponseSchema.parse({ critiques: result.data.critiques });
        res.json(body);
      }
    } catch (err) {
      next(err);
    }
  }
);
