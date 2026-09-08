import type {
  Concept,
  ConceptDetails,
  ConceptQAMessage,
  ConceptQAResponse,
} from "@thinking-explorer/shared";
import { api } from "../../api/client.js";

export function generateConceptDetails(concept: Concept): Promise<ConceptDetails> {
  return api.getConceptDetails(concept.sessionId, concept.id);
}

export interface ConceptQAResponseWithModel extends ConceptQAResponse {
  model?: string;
}

export function askConceptQuestion(
  concept: Concept,
  question: string,
  history: ConceptQAMessage[] = []
): Promise<ConceptQAResponseWithModel> {
  return api.askConceptQuestion(concept.sessionId, concept.id, {
    question,
    history,
  }) as Promise<ConceptQAResponseWithModel>;
}