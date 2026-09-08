import { randomUUID } from "node:crypto";
import { db } from "../client.js";
import type { LLMPurpose } from "@thinking-explorer/shared";

interface InsertLLMCall {
  sessionId: string | null;
  purpose: LLMPurpose;
  provider: string;
  model: string;
  requestHash: string;
  response: string;
  durationMs: number;
}

export function insertLLMCall(call: InsertLLMCall): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO llm_calls
       (id, session_id, purpose, provider, model, request_hash, response, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    call.sessionId,
    call.purpose,
    call.provider,
    call.model,
    call.requestHash,
    call.response,
    call.durationMs,
    Date.now()
  );
  return id;
}

interface InsertExplorationEvent {
  sessionId: string;
  type: "seed" | "expand" | "connect" | "challenge" | "compare";
  payload: Record<string, unknown>;
  resultSummary: string;
}

export function insertExplorationEvent(event: InsertExplorationEvent): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO exploration_events
       (id, session_id, type, payload, result_summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, event.sessionId, event.type, JSON.stringify(event.payload), event.resultSummary, Date.now());
  return id;
}

export interface CachedLLMCall {
  purpose: LLMPurpose;
  provider: string;
  model: string;
  response: string;
  durationMs: number;
}

export function lookupLLMCall(requestHash: string): CachedLLMCall | null {
  const row = db
    .prepare<[string], CachedLLMCall & { id: string }>(
      `SELECT id, purpose, provider, model, response, duration_ms AS durationMs
         FROM llm_calls
        WHERE request_hash = ?
        ORDER BY created_at DESC
        LIMIT 1`
    )
    .get(requestHash);
  return row ?? null;
}

interface ExplorationEventRow {
  id: string;
  session_id: string;
  type: "seed" | "expand" | "connect" | "challenge" | "compare";
  payload: string;
  result_summary: string;
  created_at: number;
}

export function listExplorationEvents(sessionId: string) {
  const rows = db
    .prepare<[string], ExplorationEventRow>(
      `SELECT id, session_id, type, payload, result_summary, created_at
         FROM exploration_events
        WHERE session_id = ?
        ORDER BY created_at ASC`
    )
    .all(sessionId);
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    payload: JSON.parse(row.payload),
    resultSummary: row.result_summary,
    createdAt: row.created_at,
  }));
}