import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import type { Request, Response } from "express";
import { validateBody, HttpError } from "./validate.js";

describe("validateBody middleware", () => {
  const schema = z.object({
    num: z.number(),
    str: z.string().optional(),
  });
  const middleware = validateBody(schema);

  it("passes a valid body forward and updates req.body to the parsed result", () => {
    const next = vi.fn();
    const req = { body: { num: 42, extra: "ignored" } } as Request;
    const res = {} as Response;

    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ num: 42 }); // extra stripped by Zod
  });

  it("calls next with HttpError status 400 on invalid body", () => {
    const next = vi.fn();
    const req = { body: { str: "only a string" } } as Request;
    const res = {} as Response;

    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    const err = next.mock.calls[0][0] as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.code).toBe("invalid_body");
  });
});