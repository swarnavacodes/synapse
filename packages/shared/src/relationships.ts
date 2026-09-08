import { z } from "zod";

export const RelationshipTypeSchema = z.enum([
  "supports",
  "contradicts",
  "part_of",
  "analogous_to",
  "causes",
  "requires",
  "bridges",
  "related_to",
]);
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

export const RelationshipKindSchema = z.enum([
  "fact",
  "interpretation",
  "analogy",
]);
export type RelationshipKind = z.infer<typeof RelationshipKindSchema>;

export const RelationshipOriginSchema = z.enum(["user", "llm", "derived"]);
export type RelationshipOrigin = z.infer<typeof RelationshipOriginSchema>;

export const RelationshipStyleSchema = z.enum([
  "curve",
  "straight",
  "step",
]);
export type RelationshipStyle = z.infer<typeof RelationshipStyleSchema>;

export const RelationshipSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: RelationshipTypeSchema,
  kind: RelationshipKindSchema,
  style: RelationshipStyleSchema.optional().default("curve"),
  explanation: z.string().max(1000).optional().default(""),
  strength: z.number().min(0).max(1),
  origin: RelationshipOriginSchema,
  createdAt: z.number().int().nonnegative(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;
