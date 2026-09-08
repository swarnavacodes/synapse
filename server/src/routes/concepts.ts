import { Router } from "express";
import {
  ConceptDetailsSchema,
  ConceptQARequestSchema,
  ConceptQAResponseSchema,
  CreateConceptRequestSchema,
  LLMConceptDetailsOutputSchema,
  LLMConceptQAOutputSchema,
} from "@thinking-explorer/shared";
import {
  createConcept,
  deleteConcept,
  getConcept,
} from "../db/repositories/concepts.js";
import { bumpSession, sessionExists } from "../services/graphService.js";
import { HttpError, validateBody } from "../validation/validate.js";
import { listConceptsBySession } from "../db/repositories/concepts.js";
import { listRelationshipsBySession } from "../db/repositories/relationships.js";
import { llmProvider, OpenRouterProvider } from "../services/llm/openrouter.js";
import { buildConceptDetailsPrompt, buildConceptQAPrompt } from "../services/llm/prompts.js";
import { insertLLMCall, insertExplorationEvent } from "../db/repositories/llmCalls.js";
import {
  LLMConfigurationError,
  LLMUpstreamError,
  LLMValidationError,
} from "../services/llm/provider.js";

export const conceptsRouter = Router({ mergeParams: true });

conceptsRouter.post(
  "/",
  validateBody(CreateConceptRequestSchema),
  (req, res, next) => {
    try {
      const { id: sessionId } = req.params as { id: string };
      if (!sessionExists(sessionId)) {
        throw new HttpError(404, "session_not_found", "Session not found");
      }
      const body = req.body as {
        label: string;
        category?: string;
        summary?: string;
        sourceNodeId?: string | null;
      };
      const concept = createConcept({
        sessionId,
        label: body.label,
        category: body.category,
        summary: body.summary,
        sourceNodeId: body.sourceNodeId ?? null,
      });
      if (!body.sourceNodeId) {
        insertExplorationEvent({
          sessionId,
          type: "seed",
          payload: { conceptId: concept.id, label: concept.label },
          resultSummary: `Seeded "${concept.label}"`,
        });
      }
      bumpSession(sessionId);
      res.status(201).json(concept);
    } catch (err) {
      next(err);
    }
  }
);

conceptsRouter.delete("/:conceptId", (req, res, next) => {
  try {
    const { id: sessionId, conceptId } = req.params as { id: string; conceptId: string };
    if (!sessionExists(sessionId)) {
      throw new HttpError(404, "session_not_found", "Session not found");
    }
    const existing = getConcept(conceptId);
    if (!existing || existing.sessionId !== sessionId) {
      throw new HttpError(404, "concept_not_found", "Concept not found in session");
    }
    deleteConcept(conceptId);
    bumpSession(sessionId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

conceptsRouter.get("/:conceptId/details", async (req, res, next) => {
  try {
    const { id: sessionId, conceptId } = req.params as { id: string; conceptId: string };
    if (!sessionExists(sessionId)) {
      throw new HttpError(404, "session_not_found", "Session not found");
    }
    const concept = getConcept(conceptId);
    if (!concept || concept.sessionId !== sessionId) {
      throw new HttpError(404, "concept_not_found", "Concept not found in session");
    }

    const concepts = listConceptsBySession(sessionId);
    const relationships = listRelationshipsBySession(sessionId).filter(
      (relationship) => relationship.sourceId === conceptId || relationship.targetId === conceptId
    );
    const context = relationships.map((relationship) => {
      const otherId = relationship.sourceId === conceptId
        ? relationship.targetId
        : relationship.sourceId;
      const other = concepts.find((candidate) => candidate.id === otherId);
      return {
        otherLabel: other?.label ?? "Unknown",
        type: relationship.type,
        kind: relationship.kind,
        explanation: relationship.explanation,
      };
    });
    const neighbors = context.map((relationship) => {
      const other = concepts.find((candidate) => candidate.label === relationship.otherLabel);
      return {
        label: relationship.otherLabel,
        category: other?.category,
        summary: other?.summary,
      };
    });
    const prompt = buildConceptDetailsPrompt({
      concept,
      neighbors,
      relationships: context,
    });

    let result;
    try {
      result = await llmProvider.generateJson(prompt, LLMConceptDetailsOutputSchema);
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

    if (llmProvider instanceof OpenRouterProvider) {
      insertLLMCall({
        sessionId,
        purpose: "details",
        provider: llmProvider.name,
        model: result.model,
        requestHash: llmProvider.hashRequest(prompt),
        response: result.raw,
        durationMs: result.durationMs,
      });
    }
    res.json(ConceptDetailsSchema.parse(result.data));
  } catch (err) {
    next(err);
  }
});

conceptsRouter.post(
  "/:conceptId/qa",
  validateBody(ConceptQARequestSchema),
  async (req, res, next) => {
    try {
      const { id: sessionId, conceptId } = req.params as { id: string; conceptId: string };
      const { question, history } = req.body as {
        question: string;
        history?: Array<{ role: "user" | "assistant"; text: string }>;
      };

      if (!sessionExists(sessionId)) {
        throw new HttpError(404, "session_not_found", "Session not found");
      }
      const concept = getConcept(conceptId);
      if (!concept || concept.sessionId !== sessionId) {
        throw new HttpError(404, "concept_not_found", "Concept not found in session");
      }

      const concepts = listConceptsBySession(sessionId);
      const relationships = listRelationshipsBySession(sessionId).filter(
        (relationship) => relationship.sourceId === conceptId || relationship.targetId === conceptId
      );
      const context = relationships.map((relationship) => {
        const otherId = relationship.sourceId === conceptId
          ? relationship.targetId
          : relationship.sourceId;
        const other = concepts.find((candidate) => candidate.id === otherId);
        return {
          otherLabel: other?.label ?? "Unknown",
          type: relationship.type,
          kind: relationship.kind,
          explanation: relationship.explanation,
        };
      });
      const neighbors = context.map((relationship) => {
        const other = concepts.find((candidate) => candidate.label === relationship.otherLabel);
        return {
          label: relationship.otherLabel,
          category: other?.category,
          summary: other?.summary,
        };
      });

      const prompt = buildConceptQAPrompt({
        concept,
        neighbors,
        relationships: context,
        history: history ?? [],
        question,
      });

      let result;
      try {
        result = await llmProvider.generateJson(prompt, LLMConceptQAOutputSchema);
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

      if (llmProvider instanceof OpenRouterProvider) {
        insertLLMCall({
          sessionId,
          purpose: "qa",
          provider: llmProvider.name,
          model: result.model,
          requestHash: llmProvider.hashRequest(prompt),
          response: result.raw,
          durationMs: result.durationMs,
        });
      }
      res.json(ConceptQAResponseSchema.parse(result.data));
    } catch (err) {
      next(err);
    }
  }
);