import { z } from "zod";

export const ConceptOriginSchema = z.enum(["user", "llm", "derived"]);
export type ConceptOrigin = z.infer<typeof ConceptOriginSchema>;

export const ConceptSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  label: z.string().min(1).max(200),
  category: z.string().max(100).optional().default(""),
  summary: z.string().max(2000).optional().default(""),
  origin: ConceptOriginSchema,
  sourceNodeId: z.string().nullable().optional(),
  createdAt: z.number().int().nonnegative(),
});

export type Concept = z.infer<typeof ConceptSchema>;
