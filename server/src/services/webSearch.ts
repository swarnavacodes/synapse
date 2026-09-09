import { tavily, type TavilyClient, type TavilySearchResponse } from "@tavily/core";

let client: TavilyClient | null = null;

function getClient(): TavilyClient {
  if (!client) {
    client = tavily();
  }
  return client;
}

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate: string;
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

  return {
    query: response.query,
    answer: response.answer ?? null,
    results: response.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
      publishedDate: r.publishedDate ?? null,
    })),
    responseTimeMs: response.responseTime,
  };
}

export function isWebSearchConfigured(): boolean {
  return true;
}
