import { Router } from "express";
import {
  ConnectRequestSchema,
  ConnectResponseSchema,
  LLMConnectOutputSchema,
  type Concept,
  type Relationship,
} from "@thinking-explorer/shared";
import { bumpSession, sessionExists } from "../services/graphService.js";
import { HttpError, validateBody } from "../validation/validate.js";
import { listConceptsBySession, getConcept, createConcept } from "../db/repositories/concepts.js";
import { listRelationshipsBySession, createRelationship } from "../db/repositories/relationships.js";
import { llmProvider, OpenRouterProvider } from "../services/llm/openrouter.js";
import { buildConnectPrompt } from "../services/llm/prompts.js";
import { insertExplorationEvent, insertLLMCall } from "../db/repositories/llmCalls.js";
import {
  LLMConfigurationError,
  LLMUpstreamError,
  LLMValidationError,
} from "../services/llm/provider.js";

export const connectRouter = Router({ mergeParams: true });

connectRouter.post(
  "/",
  validateBody(ConnectRequestSchema),
  async (req, res, next) => {
    try {
      const { id: sessionId } = req.params as { id: string };
      const { fromNodeId, toNodeId, maxBridges } = req.body as {
        fromNodeId: string;
        toNodeId: string;
        maxBridges: number;
      };

      if (!sessionExists(sessionId)) {
        throw new HttpError(404, "session_not_found", "Session not found");
      }

      const fromConcept = getConcept(fromNodeId);
      if (!fromConcept || fromConcept.sessionId !== sessionId) {
        throw new HttpError(404, "concept_not_found", "From concept not in session");
      }

      const toConcept = getConcept(toNodeId);
      if (!toConcept || toConcept.sessionId !== sessionId) {
        throw new HttpError(404, "concept_not_found", "To concept not in session");
      }

      const allConcepts = listConceptsBySession(sessionId);
      const allEdges = listRelationshipsBySession(sessionId);

      function getNeighbors(conceptId: string): { concepts: Concept[]; edges: Relationship[] } {
        const neighborIds = new Set<string>();
        const edges = allEdges.filter((e) => {
          if (e.sourceId === conceptId) { neighborIds.add(e.targetId); return true; }
          if (e.targetId === conceptId) { neighborIds.add(e.sourceId); return true; }
          return false;
        });
        const concepts = allConcepts.filter((c) => neighborIds.has(c.id));
        return { concepts, edges };
      }

      const fromNeighbors = getNeighbors(fromConcept.id);
      const toNeighbors = getNeighbors(toConcept.id);

      const prompt = buildConnectPrompt({
        from: fromConcept,
        to: toConcept,
        fromNeighbors: fromNeighbors.concepts,
        toNeighbors: toNeighbors.concepts,
        fromEdges: fromNeighbors.edges,
        toEdges: toNeighbors.edges,
        maxBridges,
      });

      let result;
      try {
        result = await llmProvider.generateJson(prompt, LLMConnectOutputSchema);
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

      const bridges: Array<{ concept: Concept; relationships: Relationship[] }> = [];

      for (const bridge of result.data.bridges) {
        const createdConcept = {
          sessionId,
          label: bridge.label,
          category: bridge.category,
          summary: bridge.summary,
          origin: "llm" as const,
          sourceNodeId: null,
        };

        const concept = createConcept(createdConcept);

        const relFrom = createRelationship({
          sessionId,
          sourceId: fromConcept.id,
          targetId: concept.id,
          type: bridge.fromRelationship.type,
          kind: bridge.fromRelationship.kind,
          explanation: bridge.fromRelationship.explanation,
          strength: bridge.fromRelationship.strength,
          origin: "llm",
        });

        const relTo = createRelationship({
          sessionId,
          sourceId: concept.id,
          targetId: toConcept.id,
          type: bridge.toRelationship.type,
          kind: bridge.toRelationship.kind,
          explanation: bridge.toRelationship.explanation,
          strength: bridge.toRelationship.strength,
          origin: "llm",
        });

        bridges.push({ concept, relationships: [relFrom, relTo] });
      }

      const requestHash =
        llmProvider instanceof OpenRouterProvider ? llmProvider.hashRequest(prompt) : "";
      insertLLMCall({
        sessionId,
        purpose: "connect",
        provider: llmProvider.name,
        model: result.model,
        requestHash,
        response: result.raw,
        durationMs: result.durationMs,
      });
      insertExplorationEvent({
        sessionId,
        type: "connect",
        payload: { fromNodeId, toNodeId, maxBridges },
        resultSummary: `Connected "${fromConcept.label}" ↔ "${toConcept.label}" via ${bridges.length} bridge(s)`,
      });
      bumpSession(sessionId);

      const body = ConnectResponseSchema.parse({ bridges });
      res.json(body);
    } catch (err) {
      next(err);
    }
  }
);
