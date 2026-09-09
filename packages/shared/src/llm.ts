import { z } from "zod";

export const LLMPurposeSchema = z.enum([
  "expand",
  "connect",
  "challenge",
  "compare",
  "details",
  "qa",
  "export-summary",
]);
export type LLMPurpose = z.infer<typeof LLMPurposeSchema>;

export const LLMRequestSchema = z.object({
  purpose: LLMPurposeSchema,
  system: z.string().min(1),
  user: z.string().min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});
export type LLMRequest = z.infer<typeof LLMRequestSchema>;

export const LLMResultSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    data,
    raw: z.string(),
    model: z.string(),
    usage: z
      .object({
        promptTokens: z.number().int().nonnegative(),
        completionTokens: z.number().int().nonnegative(),
      })
      .optional(),
    durationMs: z.number().int().nonnegative(),
  });
