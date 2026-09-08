import { z } from "zod";
import { ConceptSchema } from "./concepts.js";
import { RelationshipSchema } from "./relationships.js";

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
