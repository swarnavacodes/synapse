import { Router } from "express";
import { CreateRelationshipRequestSchema } from "@thinking-explorer/shared";
import { getConcept } from "../db/repositories/concepts.js";
import { createRelationship } from "../db/repositories/relationships.js";
import { bumpSession, sessionExists } from "../services/graphService.js";
import { HttpError, validateBody } from "../validation/validate.js";

export const relationshipsRouter = Router({ mergeParams: true });

relationshipsRouter.post(
  "/",
  validateBody(CreateRelationshipRequestSchema),
  (req, res, next) => {
    try {
      const { id: sessionId } = req.params as { id: string };
      if (!sessionExists(sessionId)) {
        throw new HttpError(404, "session_not_found", "Session not found");
      }
      const body = req.body as {
        sourceId: string;
        targetId: string;
        type: Parameters<typeof createRelationship>[0]["type"];
        kind: Parameters<typeof createRelationship>[0]["kind"];
        explanation?: string;
        strength?: number;
      };
      const source = getConcept(body.sourceId);
      const target = getConcept(body.targetId);
      if (!source || source.sessionId !== sessionId) {
        throw new HttpError(404, "concept_not_found", "Source concept not in session");
      }
      if (!target || target.sessionId !== sessionId) {
        throw new HttpError(404, "concept_not_found", "Target concept not in session");
      }
      const rel = createRelationship({
        sessionId,
        sourceId: body.sourceId,
        targetId: body.targetId,
        type: body.type,
        kind: body.kind,
        explanation: body.explanation,
        strength: body.strength,
      });
      bumpSession(sessionId);
      res.status(201).json(rel);
    } catch (err) {
      if (err instanceof Error && err.message === "Self-loops are not allowed") {
        next(new HttpError(400, "self_loop", err.message));
        return;
      }
      next(err);
    }
  }
);