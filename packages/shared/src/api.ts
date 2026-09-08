import { z } from "zod";
import { ConceptSchema } from "./concepts.js";
import { RelationshipSchema } from "./relationships.js";

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
  llmConfigured: z.boolean(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const CreateSessionRequestSchema = z.object({
  title: z.string().max(200).optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const SavePositionsRequestSchema = z.record(
  z.object({ x: z.number().finite(), y: z.number().finite() })
);
export type SavePositionsRequest = z.infer<typeof SavePositionsRequestSchema>;

export const CreateConceptRequestSchema = z.object({
  label: z.string().min(1).max(200),
  category: z.string().max(100).optional(),
  summary: z.string().max(2000).optional(),
  sourceNodeId: z.string().nullable().optional(),
});
export type CreateConceptRequest = z.infer<typeof CreateConceptRequestSchema>;

export const ConceptDetailsSchema = z.object({
  overview: z.string().min(1).max(1200),
  significance: z.string().min(1).max(800),
  connections: z.string().min(1).max(800),
  example: z.string().min(1).max(800),
});
export type ConceptDetails = z.infer<typeof ConceptDetailsSchema>;
export const LLMConceptDetailsOutputSchema = ConceptDetailsSchema;

export const ConceptQAMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(2000),
});
export type ConceptQAMessage = z.infer<typeof ConceptQAMessageSchema>;

export const ConceptQARequestSchema = z.object({
  question: z.string().min(1).max(500),
  history: z.array(ConceptQAMessageSchema).optional().default([]),
});
export type ConceptQARequest = z.infer<typeof ConceptQARequestSchema>;

export const ConceptQAResponseSchema = z.object({
  answer: z.string().min(1).max(2000),
  model: z.string().optional(),
});
export type ConceptQAResponse = z.infer<typeof ConceptQAResponseSchema>;
export const LLMConceptQAOutputSchema = ConceptQAResponseSchema;

export const CreateRelationshipRequestSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: RelationshipSchema.shape.type,
  kind: RelationshipSchema.shape.kind,
  explanation: z.string().max(1000).optional(),
  strength: z.number().min(0).max(1).optional(),
});
export type CreateRelationshipRequest = z.infer<
  typeof CreateRelationshipRequestSchema
>;

export const ExpandRequestSchema = z.object({
  nodeId: z.string().min(1),
  depth: z.union([z.literal(1), z.literal(2)]).optional().default(1),
  focus: z.string().max(200).optional(),
});
export type ExpandRequest = z.infer<typeof ExpandRequestSchema>;

// Shapes the LLM is asked to return for the `expand` purpose.
// No id / createdAt — those are server-assigned after validation.
export const LLMExpandConceptSchema = z.object({
  label: z.string().min(1).max(200),
  category: z.string().max(100).optional().default(""),
  summary: z.string().max(2000).optional().default(""),
});
export type LLMExpandConcept = z.infer<typeof LLMExpandConceptSchema>;

export const LLMExpandRelationshipSchema = z.object({
  // Either endpoint can refer to the seed node OR a previously-emitted new concept.
  // The server resolves these to ids after the new concepts are persisted.
  sourceRef: z.string().min(1),
  targetRef: z.string().min(1),
  type: RelationshipSchema.shape.type,
  kind: RelationshipSchema.shape.kind,
  explanation: z.string().max(1000).optional().default(""),
  strength: z.number().min(0).max(1),
});
export type LLMExpandRelationship = z.infer<typeof LLMExpandRelationshipSchema>;

export const LLMExpandOutputSchema = z.object({
  concepts: z.array(LLMExpandConceptSchema).min(1).max(12),
  relationships: z.array(LLMExpandRelationshipSchema).min(0).max(20),
});
export type LLMExpandOutput = z.infer<typeof LLMExpandOutputSchema>;

export const ExpandResponseSchema = z.object({
  concepts: z.array(ConceptSchema),
  relationships: z.array(RelationshipSchema),
});
export type ExpandResponse = z.infer<typeof ExpandResponseSchema>;

export const ConnectRequestSchema = z.object({
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  maxBridges: z.number().int().min(1).max(5).optional().default(3),
});
export type ConnectRequest = z.infer<typeof ConnectRequestSchema>;

export const ConnectResponseSchema = z.object({
  bridges: z.array(
    z.object({
      concept: ConceptSchema,
      relationships: z.array(RelationshipSchema),
    })
  ),
});
export type ConnectResponse = z.infer<typeof ConnectResponseSchema>;

// Shapes the LLM is asked to return for the `connect` purpose.
// Each bridge is a new concept with edges to both seed nodes.
export const LLMConnectBridgeSchema = z.object({
  label: z.string().min(1).max(200),
  category: z.string().max(100).optional().default(""),
  summary: z.string().max(2000).optional().default(""),
  // Two relationships: one to "from", one to "to"
  fromRelationship: z.object({
    type: z.enum(["supports", "contradicts", "part_of", "analogous_to", "causes", "requires", "bridges", "related_to"]),
    kind: z.enum(["fact", "interpretation", "analogy"]),
    explanation: z.string().max(1000).optional().default(""),
    strength: z.number().min(0).max(1),
  }),
  toRelationship: z.object({
    type: z.enum(["supports", "contradicts", "part_of", "analogous_to", "causes", "requires", "bridges", "related_to"]),
    kind: z.enum(["fact", "interpretation", "analogy"]),
    explanation: z.string().max(1000).optional().default(""),
    strength: z.number().min(0).max(1),
  }),
});
export type LLMConnectBridge = z.infer<typeof LLMConnectBridgeSchema>;

export const LLMConnectOutputSchema = z.object({
  bridges: z.array(LLMConnectBridgeSchema).min(1).max(5),
});
export type LLMConnectOutput = z.infer<typeof LLMConnectOutputSchema>;

export const ChallengeRequestSchema = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("concept"), id: z.string().min(1) }),
    z.object({ kind: z.literal("relationship"), id: z.string().min(1) }),
  ]),
});
export type ChallengeRequest = z.infer<typeof ChallengeRequestSchema>;

export const CritiqueSchema = z.object({
  text: z.string().min(1).max(500),
  severity: z.enum(["minor", "moderate", "significant"]),
  aspect: z.string().max(100),
});
export type Critique = z.infer<typeof CritiqueSchema>;

export const ChallengeResponseSchema = z.object({
  critiques: z.array(CritiqueSchema),
});
export type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>;

export const LLMChallengeOutputSchema = z.object({
  critiques: z.array(CritiqueSchema).min(2).max(5),
});
export type LLMChallengeOutput = z.infer<typeof LLMChallengeOutputSchema>;

export const CompareRequestSchema = z.object({
  aNodeId: z.string().min(1),
  bNodeId: z.string().min(1),
  axes: z.array(z.string().max(100)).max(8).optional(),
});
export type CompareRequest = z.infer<typeof CompareRequestSchema>;

export const CompareAxisSchema = z.object({
  axis: z.string(),
  aValue: z.string(),
  bValue: z.string(),
});
export type CompareAxis = z.infer<typeof CompareAxisSchema>;

export const CompareResponseSchema = z.object({
  axes: z.array(CompareAxisSchema),
  summary: z.string(),
});
export type CompareResponse = z.infer<typeof CompareResponseSchema>;

export const LLMCompareOutputSchema = z.object({
  axes: z.array(CompareAxisSchema).min(3).max(6),
  summary: z.string().min(1).max(300),
});
export type LLMCompareOutput = z.infer<typeof LLMCompareOutputSchema>;

export const TrailEventSchema = z.object({
  id: z.string(),
  type: z.enum(["seed", "expand", "connect", "challenge", "compare"]),
  payload: z.record(z.unknown()),
  resultSummary: z.string(),
  createdAt: z.number(),
});
export type TrailEvent = z.infer<typeof TrailEventSchema>;
