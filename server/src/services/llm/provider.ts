import type { LLMRequest } from "@thinking-explorer/shared";
import type { ZodTypeAny, z } from "zod";

export interface LLMResult<T> {
  data: T;
  raw: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
  durationMs: number;
}

export interface LLMProvider {
  readonly name: string;
  generateJson<T extends ZodTypeAny>(
    req: LLMRequest,
    schema: T
  ): Promise<LLMResult<z.infer<T>>>;
}

export class LLMConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMConfigurationError";
  }
}

export class LLMValidationError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
    public readonly issues: unknown
  ) {
    super(message);
    this.name = "LLMValidationError";
  }
}

export class LLMUpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "LLMUpstreamError";
  }
}