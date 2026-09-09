import { Router } from "express";
import {
  WebSearchRequestSchema,
  WebSearchResponseSchema,
} from "@thinking-explorer/shared";
import { sessionExists, bumpSession } from "../services/graphService.js";
import { HttpError, validateBody } from "../validation/validate.js";
import { createConcept } from "../db/repositories/concepts.js";
import { insertExplorationEvent } from "../db/repositories/llmCalls.js";
import { webSearch } from "../services/webSearch.js";

export const searchRouter = Router({ mergeParams: true });

searchRouter.post(
  "/",
  validateBody(WebSearchRequestSchema),
  async (req, res, next) => {
    try {
      const { id: sessionId } = req.params as { id: string };
      const { query, maxResults, topic } = req.body as {
        query: string;
        maxResults?: number;
        topic?: "general" | "news";
      };

      if (!sessionExists(sessionId)) {
        throw new HttpError(404, "session_not_found", "Session not found");
      }

      let searchOutput;
      try {
        searchOutput = await webSearch(query, { maxResults, topic });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed";
        throw new HttpError(502, "search_upstream_error", message);
      }

      const topResults = searchOutput.results.slice(0, maxResults ?? 5);

      const concepts = topResults.map((r) =>
        createConcept({
          sessionId,
          label: truncate(r.title, 200),
          category: "web search",
          summary: truncate(r.content, 2000),
          origin: "llm",
          sourceNodeId: null,
        })
      );

      bumpSession(sessionId);

      insertExplorationEvent({
        sessionId,
        type: "expand",
        payload: { query, resultCount: concepts.length },
        resultSummary: `Web search: "${query}" → ${concepts.length} result(s)`,
      });

      const body = WebSearchResponseSchema.parse({
        query: searchOutput.query,
        answer: searchOutput.answer,
        results: topResults,
        responseTimeMs: searchOutput.responseTimeMs,
      });
      res.json(body);
    } catch (err) {
      next(err);
    }
  }
);

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
