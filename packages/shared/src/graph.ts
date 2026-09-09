import { z } from "zod";
import { ConceptSchema, ConceptOriginSchema } from "./concepts.js";
import { RelationshipSchema, RelationshipTypeSchema, RelationshipKindSchema } from "./relationships.js";

export const SessionSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200).nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type Session = z.infer<typeof SessionSchema>;

export const ExplorationEventTypeSchema = z.enum([
  "seed",
  "expand",
  "connect",
  "challenge",
  "compare",
]);
export type ExplorationEventType = z.infer<typeof ExplorationEventTypeSchema>;

export const ExplorationEventSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  type: ExplorationEventTypeSchema,
  payload: z.record(z.unknown()),
  resultSummary: z.string().max(500),
  createdAt: z.number().int().nonnegative(),
});
export type ExplorationEvent = z.infer<typeof ExplorationEventSchema>;

export const GraphSchema = z.object({
  session: SessionSchema,
  concepts: z.array(ConceptSchema),
  relationships: z.array(RelationshipSchema),
  positions: z.record(z.object({ x: z.number(), y: z.number() })),
  events: z.array(ExplorationEventSchema),
});
export type Graph = z.infer<typeof GraphSchema>;

export const ExportSummarySchema = z.object({
  session: SessionSchema,
  conceptCount: z.number().int().nonnegative(),
  relationshipCount: z.number().int().nonnegative(),
  concepts: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      category: z.string().optional(),
      summary: z.string().optional(),
      origin: ConceptOriginSchema,
    })
  ),
  relationships: z.array(
    z.object({
      id: z.string(),
      sourceLabel: z.string(),
      targetLabel: z.string(),
      type: RelationshipTypeSchema,
      kind: RelationshipKindSchema,
      explanation: z.string().optional(),
      strength: z.number(),
    })
  ),
  qaSynthesis: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    })
  ),
  narrative: z.string(),
  exportedAt: z.number().int().nonnegative(),
});
export type ExportSummary = z.infer<typeof ExportSummarySchema>;
