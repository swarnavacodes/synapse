import { Router, type Request, type Response, type NextFunction } from "express";
import {
  CreateSessionRequestSchema,
  SavePositionsRequestSchema,
  type Session,
} from "@thinking-explorer/shared";
import {
  listSessions,
  createSession,
  deleteSession,
} from "../db/repositories/sessions.js";
import { loadGraph } from "../services/graphService.js";
import { validateBody } from "../validation/validate.js";
import { savePositions } from "../db/repositories/positions.js";
import { sessionExists, bumpSession } from "../services/graphService.js";

export const sessionsRouter = Router();

sessionsRouter.get("/", (_req, res) => {
  const sessions: Session[] = listSessions();
  res.json(sessions);
});

sessionsRouter.post("/", validateBody(CreateSessionRequestSchema), (req, res) => {
  const { title } = req.body as { title?: string };
  const session = createSession(title ?? null);
  res.status(201).json(session);
});

sessionsRouter.get("/:id", (req, res, next) => {
  try {
    const graph = loadGraph(req.params.id);
    res.json(graph);
  } catch (err) {
    next(err);
  }
});

sessionsRouter.put(
  "/:id/positions",
  validateBody(SavePositionsRequestSchema),
  (req, res, next) => {
    try {
      const sessionId = req.params.id;
      if (!sessionExists(sessionId)) {
        return res.status(404).json({ error: { code: "session_not_found", message: "Session not found" } });
      }
      savePositions(sessionId, req.body);
      bumpSession(sessionId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

sessionsRouter.delete("/:id", (req, res, next) => {
  try {
    const ok = deleteSession(req.params.id);
    if (!ok) {
      return res
        .status(404)
        .json({ error: { code: "session_not_found", message: "Session not found" } });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Catch-all for unknown sessions sub-routes, keeps error format consistent.
sessionsRouter.use((err: unknown, _req: Request, _res: Response, next: NextFunction) => {
  next(err);
});