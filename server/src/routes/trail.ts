import { Router } from "express";
import { sessionExists } from "../services/graphService.js";
import { HttpError } from "../validation/validate.js";
import { listExplorationEvents } from "../db/repositories/llmCalls.js";

export const trailRouter = Router({ mergeParams: true });

trailRouter.get("/", async (req, res, next) => {
  try {
    const { id: sessionId } = req.params as { id: string };

    if (!sessionExists(sessionId)) {
      throw new HttpError(404, "session_not_found", "Session not found");
    }

    const events = listExplorationEvents(sessionId);
    res.json({ events });
  } catch (err) {
    next(err);
  }
});
