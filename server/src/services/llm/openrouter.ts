import { createHash } from "node:crypto";
import type { LLMRequest } from "@thinking-explorer/shared";
import type { ZodTypeAny, z } from "zod";
import { config } from "../../config.js";
import { lookupLLMCall } from "../../db/repositories/llmCalls.js";
import {
  LLMConfigurationError,
  LLMUpstreamError,
  LLMValidationError,
  type LLMProvider,
  type LLMResult,
} from "./provider.js";

interface ChatCompletionResponse {
  id?: string;
  model: string;
  error?: { message?: string; code?: number | string };
  choices: Array<{
    message: { role: "assistant"; content: string };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function hashRequest(req: LLMRequest): string {
  const norm = JSON.stringify({
    purpose: req.purpose,
    model: req.model ?? null,
    temperature: req.temperature ?? null,
    system: req.system,
    user: req.user,
  });
  return createHash("sha256").update(norm).digest("hex");
}

export function extractJson(text: string): unknown {
  // Strip ```json fences and any leading prose.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  // Find the first balanced JSON object/array.
  const trimmed = raw.trim();
  const firstBrace = trimmed.search(/[\[{]/);
  if (firstBrace === -1) throw new Error("No JSON object found in LLM response");
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = firstBrace; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inStr) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        return JSON.parse(trimmed.slice(firstBrace, i + 1));
      }
    }
  }
  throw new Error("Unbalanced JSON in LLM response");
}

function isTimeoutError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) ||
    /aborted.*timeout|timeout.*aborted/i.test(message)
  );
}

export class OpenRouterProvider implements LLMProvider {
  readonly name = "openrouter";
  private readonly maxRetries = 1;

  async generateJson<T extends ZodTypeAny>(
    req: LLMRequest,
    schema: T
  ): Promise<LLMResult<z.infer<T>>> {
    if (!config.openrouter.apiKey) {
      throw new LLMConfigurationError(
        "OPENROUTER_API_KEY is not set. Add it to your .env file."
      );
    }
    const requestHash = hashRequest(req);
    const cached = lookupLLMCall(requestHash);
    if (cached) {
      try {
        const parsed = extractJson(cached.response);
        const result = schema.safeParse(parsed);
        if (result.success) {
          return {
            data: result.data as z.infer<T>,
            raw: cached.response,
            model: cached.model,
            usage: undefined,
            durationMs: 0,
          };
        }
      } catch {
        // Stored response failed to parse — fall through to a live call.
      }
    }
    const models = [
      ...new Set([req.model ?? config.openrouter.model, ...config.openrouter.fallbackModels]),
    ];
    let lastUpstreamError: LLMUpstreamError | null = null;
    const upstreamErrors: string[] = [];
    for (const model of models) {
      try {
        return await this.generateJsonWithModel(req, schema, model);
      } catch (err) {
        if (!(err instanceof LLMUpstreamError)) throw err;
        lastUpstreamError = err;
        upstreamErrors.push(`${model}: ${err.message}`);
      }
    }
    if (lastUpstreamError) {
      throw new LLMUpstreamError(
        `All OpenRouter models failed: ${upstreamErrors.join(" | ")}`,
        lastUpstreamError.status,
        { models: upstreamErrors }
      );
    }
    throw new LLMUpstreamError("No OpenRouter models are configured.", 503);
  }

  private async generateJsonWithModel<T extends ZodTypeAny>(
    req: LLMRequest,
    schema: T,
    model: string
  ): Promise<LLMResult<z.infer<T>>> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const started = Date.now();
      let res: Response;
      try {
        res = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
          method: "POST",
          signal: AbortSignal.timeout(config.openrouter.timeoutMs),
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.openrouter.apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: req.temperature ?? 0.4,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: req.system },
              { role: "user", content: req.user },
            ],
          }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isTimeoutError(err)) {
          throw new LLMUpstreamError(
            `OpenRouter request timed out after ${config.openrouter.timeoutMs / 1000} seconds.`,
            504
          );
        }
        throw new LLMUpstreamError(
          `Network error calling OpenRouter: ${message}`,
          0
        );
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new LLMUpstreamError(
          `OpenRouter returned ${res.status}: ${body.slice(0, 300)}`,
          res.status,
          body
        );
      }

      let json: ChatCompletionResponse;
      try {
        json = (await res.json()) as ChatCompletionResponse;
      } catch (err) {
        if (isTimeoutError(err)) {
          throw new LLMUpstreamError(
            `OpenRouter response timed out after ${config.openrouter.timeoutMs / 1000} seconds.`,
            504
          );
        }
        throw new LLMUpstreamError(
          `Could not read OpenRouter response: ${err instanceof Error ? err.message : String(err)}`,
          res.status
        );
      }
      if (json.error) {
        throw new LLMUpstreamError(
          `OpenRouter provider error: ${json.error.message ?? "Unknown upstream error"}`,
          typeof json.error.code === "number" ? json.error.code : res.status,
          json.error
        );
      }
      const text = json.choices?.[0]?.message?.content ?? "";
      const durationMs = Date.now() - started;

      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch (err) {
        lastError = err;
        if (attempt === this.maxRetries) {
          throw new LLMValidationError(
            `LLM response was not parseable JSON: ${err instanceof Error ? err.message : String(err)}`,
            text,
            null
          );
        }
        continue;
      }

      const result = schema.safeParse(parsed);
      if (result.success) {
        return {
          data: result.data as z.infer<T>,
          raw: text,
          model: json.model ?? model,
          usage: json.usage
            ? {
                promptTokens: json.usage.prompt_tokens ?? 0,
                completionTokens: json.usage.completion_tokens ?? 0,
              }
            : undefined,
          durationMs,
        };
      }

      lastError = result.error;
      if (attempt === this.maxRetries) {
        throw new LLMValidationError(
          "LLM output failed schema validation",
          text,
          result.error.flatten()
        );
      }
    }
    throw new LLMValidationError(
      "LLM output failed after retries",
      "",
      lastError
    );
  }

  hashRequest(req: LLMRequest): string {
    return hashRequest(req);
  }
}

export const llmProvider: LLMProvider = new OpenRouterProvider();