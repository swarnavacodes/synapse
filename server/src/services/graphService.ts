import type { Graph } from "@thinking-explorer/shared";
import { GraphSchema } from "@thinking-explorer/shared";
import { getSession, touchSession } from "../db/repositories/sessions.js";
import { listConceptsBySession } from "../db/repositories/concepts.js";
import { listRelationshipsBySession } from "../db/repositories/relationships.js";
import { listPositionsBySession } from "../db/repositories/positions.js";
import { HttpError } from "../validation/validate.js";

export function loadGraph(sessionId: string): Graph {
  const session = getSession(sessionId);
  if (!session) {
    throw new HttpError(404, "session_not_found", `Session ${sessionId} not found`);
  }
  const concepts = listConceptsBySession(sessionId);
  const relationships = listRelationshipsBySession(sessionId);
  return GraphSchema.parse({
    session,
    concepts,
    relationships,
    positions: listPositionsBySession(sessionId),
    events: [],
  });
}

export function sessionExists(sessionId: string): boolean {
  return getSession(sessionId) !== null;
}

export function bumpSession(sessionId: string): void {
  touchSession(sessionId);
}