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

export const RelationshipSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: RelationshipTypeSchema,
  kind: RelationshipKindSchema,
  explanation: z.string().max(1000).optional().default(""),
  strength: z.number().min(0).max(1),
  origin: RelationshipOriginSchema,
  createdAt: z.number().int().nonnegative(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;
