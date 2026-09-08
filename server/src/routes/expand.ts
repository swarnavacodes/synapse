import { Router } from "express";
import {
  ExpandRequestSchema,
  ExpandResponseSchema,
  LLMExpandOutputSchema,
  type Concept,
  type LLMExpandOutput,
  type Relationship,
} from "@thinking-explorer/shared";
import { bumpSession, sessionExists } from "../services/graphService.js";
import { HttpError, validateBody } from "../validation/validate.js";
import {
  listConceptsBySession,
  getConcept,
} from "../db/repositories/concepts.js";
import {
  listRelationshipsBySession,
  createRelationship,
} from "../db/repositories/relationships.js";
import { createConcept } from "../db/repositories/concepts.js";
import { llmProvider, OpenRouterProvider } from "../services/llm/openrouter.js";
import { buildExpandPrompt } from "../services/llm/prompts.js";
import { insertExplorationEvent, insertLLMCall } from "../db/repositories/llmCalls.js";
import {
  LLMConfigurationError,
  LLMUpstreamError,
  LLMValidationError,
} from "../services/llm/provider.js";

export const expandRouter = Router({ mergeParams: true });

expandRouter.post(
  "/",
  validateBody(ExpandRequestSchema),
  async (req, res, next) => {
    try {
      const { id: sessionId } = req.params as { id: string };
      const { nodeId, depth, focus } = req.body as {
        nodeId: string;
        depth: 1 | 2;
        focus?: string;
      };

      if (!sessionExists(sessionId)) {
        throw new HttpError(404, "session_not_found", "Session not found");
      }
      const seed = getConcept(nodeId);
      if (!seed || seed.sessionId !== sessionId) {
        throw new HttpError(404, "concept_not_found", "Seed concept not in session");
      }

      const allConcepts = listConceptsBySession(sessionId);
      const allEdges = listRelationshipsBySession(sessionId);
      const neighbourIds = new Set<string>();
      const neighbourhoodEdges = allEdges.filter((e) => {
        if (e.sourceId === seed.id) { neighbourIds.add(e.targetId); return true; }
        if (e.targetId === seed.id) { neighbourIds.add(e.sourceId); return true; }
        return false;
      });
      const neighbours = allConcepts.filter((c) => neighbourIds.has(c.id));

      const prompt = buildExpandPrompt({ seed, neighbors: neighbours, neighborhoodEdges: neighbourhoodEdges, depth, focus });

      let result;
      try {
        result = await llmProvider.generateJson(prompt, LLMExpandOutputSchema);
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

      // Resolve LLM ref tokens ("seed" or label) to concrete ids after we persist new concepts.
      const output: LLMExpandOutput = result.data;
      const labelToNewId = new Map<string, string>();
      const newConcepts: Concept[] = [];
      for (const c of output.concepts) {
        const created = createConcept({
          sessionId,
          label: c.label,
          category: c.category,
          summary: c.summary,
          origin: "llm",
          sourceNodeId: seed.id,
        });
        newConcepts.push(created);
        labelToNewId.set(created.label, created.id);
      }

      const seedId = seed.id;
      function resolveRef(ref: string): string | null {
        if (ref === "seed") return seedId;
        return labelToNewId.get(ref) ?? null;
      }

      const newRelationships: Relationship[] = [];
      for (const r of output.relationships) {
        const sourceId = resolveRef(r.sourceRef);
        const targetId = resolveRef(r.targetRef);
        if (!sourceId || !targetId) {
          // Skip references to unknown labels — invalid output was already validated,
          // but defensive in case a model emits a reference to an unrelated concept.
          continue;
        }
        if (sourceId === targetId) continue;
        // If the edge already exists, skip.
        const dup = allEdges.some(
          (e) =>
            e.sourceId === sourceId &&
            e.targetId === targetId &&
            e.type === r.type
        );
        if (dup) continue;
        const rel = createRelationship({
          sessionId,
          sourceId,
          targetId,
          type: r.type,
          kind: r.kind,
          explanation: r.explanation,
          strength: r.strength,
          origin: "llm",
        });
        newRelationships.push(rel);
      }

      // Keep every expansion connected to its parent even when a model returns
      // valid child-to-child relationships but omits a seed edge.
      const connectedToSeed = new Set<string>();
      for (const relationship of newRelationships) {
        if (relationship.sourceId === seedId) connectedToSeed.add(relationship.targetId);
        if (relationship.targetId === seedId) connectedToSeed.add(relationship.sourceId);
      }
      for (const concept of newConcepts) {
        if (connectedToSeed.has(concept.id)) continue;
        const rel = createRelationship({
          sessionId,
          sourceId: seedId,
          targetId: concept.id,
          type: "related_to",
          kind: "interpretation",
          explanation: `Expanded from "${seed.label}".`,
          strength: 0.5,
          origin: "derived",
        });
        newRelationships.push(rel);
      }

      const requestHash =
        llmProvider instanceof OpenRouterProvider ? llmProvider.hashRequest(prompt) : "";
      insertLLMCall({
        sessionId,
        purpose: "expand",
        provider: llmProvider.name,
        model: result.model,
        requestHash,
        response: result.raw,
        durationMs: result.durationMs,
      });
      insertExplorationEvent({
        sessionId,
        type: "expand",
        payload: { nodeId: seed.id, depth, focus: focus ?? null },
        resultSummary: `Expanded "${seed.label}" → ${newConcepts.length} concepts, ${newRelationships.length} edges`,
      });
      bumpSession(sessionId);

      const body = ExpandResponseSchema.parse({
        concepts: newConcepts,
        relationships: newRelationships,
      });
      res.json(body);
    } catch (err) {
      next(err);
    }
  }
);