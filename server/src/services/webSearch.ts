import { tavily, type TavilyClient, type TavilySearchResponse } from "@tavily/core";
import { config } from "../config.js";
import type { WebSearchResult } from "@thinking-explorer/shared";
import { WebSearchResultSchema } from "@thinking-explorer/shared";

let client: TavilyClient | null = null;

function getClient(): TavilyClient {
  if (!client) {
    client = config.tavily.apiKey
      ? tavily({ apiKey: config.tavily.apiKey })
      : tavily();
  }
  return client;
}

export interface WebSearchOutput {
  query: string;
  answer: string | null;
  results: WebSearchResult[];
  responseTimeMs: number;
}

export async function webSearch(
  query: string,
  opts?: { maxResults?: number; topic?: "general" | "news" }
): Promise<WebSearchOutput> {
  const c = getClient();
  const response: TavilySearchResponse = await c.search(query, {
    maxResults: opts?.maxResults ?? 5,
    topic: opts?.topic ?? "general",
    searchDepth: "basic",
    includeAnswer: "basic",
  });

  const results = WebSearchResultSchema.array().parse(
    response.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
      publishedDate: r.publishedDate ?? null,
    }))
  );

  return {
    query: response.query,
    answer: response.answer ?? null,
    results,
    responseTimeMs: response.responseTime,
  };
}

export function isWebSearchConfigured(): boolean {
  return true;
}
