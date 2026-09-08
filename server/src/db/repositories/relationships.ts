import { randomUUID } from "node:crypto";
import { db } from "../client.js";
import {
  RelationshipSchema,
  type Relationship,
  type RelationshipKind,
  type RelationshipOrigin,
  type RelationshipType,
} from "@thinking-explorer/shared";

type RelationshipRow = {
  id: string;
  session_id: string;
  source_id: string;
  target_id: string;
  type: RelationshipType;
  kind: RelationshipKind;
  explanation: string;
  strength: number;
  origin: RelationshipOrigin;
  created_at: number;
};

function rowToRelationship(row: RelationshipRow): Relationship {
  return RelationshipSchema.parse({
    id: row.id,
    sessionId: row.session_id,
    sourceId: row.source_id,
    targetId: row.target_id,
    type: row.type,
    kind: row.kind,
    explanation: row.explanation,
    strength: row.strength,
    origin: row.origin,
    createdAt: row.created_at,
  });
}

export function listRelationshipsBySession(sessionId: string): Relationship[] {
  const rows = db
    .prepare<[string], RelationshipRow>(
      `SELECT id, session_id, source_id, target_id, type, kind, explanation, strength, origin, created_at
         FROM relationships
        WHERE session_id = ?
        ORDER BY created_at ASC`
    )
    .all(sessionId);
  return rows.map(rowToRelationship);
}

export interface CreateRelationshipInput {
  sessionId: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  kind: RelationshipKind;
  explanation?: string;
  strength?: number;
  origin?: RelationshipOrigin;
}

export function createRelationship(input: CreateRelationshipInput): Relationship {
  if (input.sourceId === input.targetId) {
    throw new Error("Self-loops are not allowed");
  }
  const now = Date.now();
  const id = randomUUID();
  const origin: RelationshipOrigin = input.origin ?? "user";
  const explanation = input.explanation ?? "";
  const strength = Math.min(1, Math.max(0, input.strength ?? 0.5));

  db.prepare(
    `INSERT INTO relationships
       (id, session_id, source_id, target_id, type, kind, explanation, strength, origin, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.sessionId,
    input.sourceId,
    input.targetId,
    input.type,
    input.kind,
    explanation,
    strength,
    origin,
    now
  );

  return RelationshipSchema.parse({
    id,
    sessionId: input.sessionId,
    sourceId: input.sourceId,
    targetId: input.targetId,
    type: input.type,
    kind: input.kind,
    explanation,
    strength,
    origin,
    createdAt: now,
  });
}

export function getRelationship(id: string): Relationship | null {
  const row = db
    .prepare<[string], RelationshipRow>(
      `SELECT id, session_id, source_id, target_id, type, kind, explanation, strength, origin, created_at
         FROM relationships
        WHERE id = ?`
    )
    .get(id);
  return row ? rowToRelationship(row) : null;
}