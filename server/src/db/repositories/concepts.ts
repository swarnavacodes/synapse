import { randomUUID } from "node:crypto";
import { db } from "../client.js";
import { ConceptSchema, type Concept, type ConceptOrigin } from "@thinking-explorer/shared";

type ConceptRow = {
  id: string;
  session_id: string;
  label: string;
  category: string;
  summary: string;
  origin: ConceptOrigin;
  source_node_id: string | null;
  created_at: number;
};

function rowToConcept(row: ConceptRow): Concept {
  return ConceptSchema.parse({
    id: row.id,
    sessionId: row.session_id,
    label: row.label,
    category: row.category,
    summary: row.summary,
    origin: row.origin,
    sourceNodeId: row.source_node_id,
    createdAt: row.created_at,
  });
}

export function listConceptsBySession(sessionId: string): Concept[] {
  const rows = db
    .prepare<[string], ConceptRow>(
      `SELECT id, session_id, label, category, summary, origin, source_node_id, created_at
         FROM concepts
        WHERE session_id = ?
        ORDER BY created_at ASC`
    )
    .all(sessionId);
  return rows.map(rowToConcept);
}

export function getConcept(id: string): Concept | null {
  const row = db
    .prepare<[string], ConceptRow>(
      `SELECT id, session_id, label, category, summary, origin, source_node_id, created_at
         FROM concepts
        WHERE id = ?`
    )
    .get(id);
  return row ? rowToConcept(row) : null;
}

export interface CreateConceptInput {
  sessionId: string;
  label: string;
  category?: string;
  summary?: string;
  origin?: ConceptOrigin;
  sourceNodeId?: string | null;
}

export function createConcept(input: CreateConceptInput): Concept {
  const now = Date.now();
  const id = randomUUID();
  const origin: ConceptOrigin = input.origin ?? "user";
  const category = input.category ?? "";
  const summary = input.summary ?? "";
  const sourceNodeId = input.sourceNodeId ?? null;

  db.prepare(
    `INSERT INTO concepts
       (id, session_id, label, category, summary, origin, source_node_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.sessionId,
    input.label,
    category,
    summary,
    origin,
    sourceNodeId,
    now
  );

  return ConceptSchema.parse({
    id,
    sessionId: input.sessionId,
    label: input.label,
    category,
    summary,
    origin,
    sourceNodeId,
    createdAt: now,
  });
}

export function deleteConcept(id: string): boolean {
  const info = db.prepare(`DELETE FROM concepts WHERE id = ?`).run(id);
  return info.changes > 0;
}