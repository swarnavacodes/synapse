import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z, type ZodTypeAny } from "zod";
import type { LLMRequest } from "@thinking-explorer/shared";

vi.mock("../../db/repositories/llmCalls.js", () => ({
  lookupLLMCall: vi.fn(),
}));

import { lookupLLMCall } from "../../db/repositories/llmCalls.js";

const mockedLookup = vi.mocked(lookupLLMCall);

type ProviderModule = typeof import("./openrouter.js");

let providerModule: ProviderModule;
let config: typeof import("../../config.js").config;

function makeRequest(overrides: Partial<LLMRequest> = {}): LLMRequest {
  return {
    purpose: "expand",
    system: "You are a helpful assistant.",
    user: "Expand Consciousness.",
    ...overrides,
  };
}

function goodCompletion(content: string, model = "test-model") {
  return {
    model,
    choices: [{ message: { role: "assistant", content } }],
    usage: { prompt_tokens: 12, completion_tokens: 4 },
  };
}

function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "primary-model";
  process.env.OPENROUTER_FALLBACK_MODELS = "model-a:free,model-b:free";
  vi.resetModules();
  providerModule = await import("./openrouter.js");
  config = (await import("../../config.js")).config;
  mockedLookup.mockReset();
  mockedLookup.mockReturnValue(null);
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
  delete process.env.OPENROUTER_FALLBACK_MODELS;
  vi.unstubAllGlobals();
});

describe("extractJson", () => {
  it("parses a plain JSON object", () => {
    expect(providerModule.extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown fences", () => {
    const fenced = '```json\n{"a": 1}\n```';
    expect(providerModule.extractJson(fenced)).toEqual({ a: 1 });
  });

  it("ignores leading prose and trailing commentary", () => {
    const text = 'Here you go:\n{"a": 1}\nHope that helps!';
    expect(providerModule.extractJson(text)).toEqual({ a: 1 });
  });

  it("handles braces inside string values", () => {
    const text = '{"nested": "a { b } c"} trailing';
    expect(providerModule.extractJson(text)).toEqual({ nested: "a { b } c" });
  });

  it("throws when no JSON is present", () => {
    expect(() => providerModule.extractJson("just words")).toThrow(/No JSON object found/);
  });

  it("throws on unbalanced JSON", () => {
    expect(() => providerModule.extractJson('{"a": 1')).toThrow(/Unbalanced/);
  });
});

describe("hashRequest", () => {
  it("is deterministic for identical requests", () => {
    const a = providerModule.llmProvider.hashRequest(makeRequest());
    const b = providerModule.llmProvider.hashRequest(makeRequest());
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs when inputs change", () => {
    const base = providerModule.llmProvider.hashRequest(makeRequest());
    const differentUser = providerModule.llmProvider.hashRequest(
      makeRequest({ user: "Expand something else." })
    );
    const differentModel = providerModule.llmProvider.hashRequest(
      makeRequest({ model: "another/model" })
    );
    expect(differentUser).not.toBe(base);
    expect(differentModel).not.toBe(base);
  });
});

describe("generateJson", () => {
  const labelSchema: ZodTypeAny = z.object({ label: z.string() });

  it("serves a cache hit without calling the provider", async () => {
    mockedLookup.mockReturnValue({
      purpose: "expand",
      provider: "openrouter",
      model: "cached-model",
      response: JSON.stringify({ label: "Cached" }),
      durationMs: 0,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await providerModule.llmProvider.generateJson(makeRequest(), labelSchema);

    expect(result.data).toEqual({ label: "Cached" });
    expect(result.model).toBe("cached-model");
    expect(result.durationMs).toBe(0);
    expect(result.usage).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls through to a live call when the cached payload is stale", async () => {
    mockedLookup.mockReturnValue({
      purpose: "expand",
      provider: "openrouter",
      model: "cached-model",
      response: "{ definitely not json",
      durationMs: 0,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        fakeResponse(200, goodCompletion(JSON.stringify({ label: "Fresh" })))
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await providerModule.llmProvider.generateJson(makeRequest(), labelSchema);

    expect(result.data).toEqual({ label: "Fresh" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("validates provider output and returns the parsed result", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      fakeResponse(200, goodCompletion(JSON.stringify({ label: "Fresh" })))
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await providerModule.llmProvider.generateJson(makeRequest(), labelSchema);

    expect(result.data).toEqual({ label: "Fresh" });
    expect(result.model).toBe("test-model");
    expect(result.usage?.promptTokens).toBe(12);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/chat/completions");
    const body = JSON.parse((init as { body: string }).body);
    expect(body.model).toBe("primary-model");
    expect(body.temperature).toBe(0.4);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("falls back to configured models when the primary fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(429, { error: { message: "Rate limited" } }))
      .mockResolvedValueOnce(
        fakeResponse(200, goodCompletion(JSON.stringify({ label: "Fallback win" })))
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await providerModule.llmProvider.generateJson(makeRequest(), labelSchema);

    expect(result.data).toEqual({ label: "Fallback win" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
    expect(secondBody.model).toBe("model-a:free");
  });

  it("aggregates a single upstream error when every model fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(500, {}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      providerModule.llmProvider.generateJson(makeRequest(), labelSchema)
    ).rejects.toMatchObject({ name: "LLMUpstreamError" });

    const modelCount = 1 + config.openrouter.fallbackModels.length;
    expect(fetchMock).toHaveBeenCalledTimes(modelCount);
  });

  it("throws LLMValidationError when output is not JSON across retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeResponse(200, goodCompletion("just words")));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      providerModule.llmProvider.generateJson(makeRequest(), labelSchema)
    ).rejects.toMatchObject({ name: "LLMValidationError" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws LLMValidationError when JSON fails schema validation across retries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeResponse(200, goodCompletion(JSON.stringify({ unrelated: true })))
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      providerModule.llmProvider.generateJson(makeRequest(), labelSchema)
    ).rejects.toMatchObject({ name: "LLMValidationError" });
  });

  it("returns an upstream error for HTTP failures as LLMUpstreamError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(401, {}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      providerModule.llmProvider.generateJson(makeRequest(), labelSchema)
    ).rejects.toMatchObject({ name: "LLMUpstreamError", status: 401 });
  });
});