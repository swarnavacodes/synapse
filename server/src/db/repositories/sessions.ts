import { randomUUID } from "node:crypto";
import { db } from "../client.js";
import type { Session } from "@thinking-explorer/shared";

type SessionRow = {
  id: string;
  title: string | null;
  created_at: number;
  updated_at: number;
};

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listSessions(): Session[] {
  const rows = db
    .prepare<[], SessionRow>(
      `SELECT id, title, created_at, updated_at
         FROM sessions
        ORDER BY updated_at DESC`
    )
    .all();
  return rows.map(rowToSession);
}

export function createSession(title: string | null): Session {
  const now = Date.now();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO sessions (id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?)`
  ).run(id, title, now, now);
  return { id, title, createdAt: now, updatedAt: now };
}

export function getSession(id: string): Session | null {
  const row = db
    .prepare<[string], SessionRow>(
      `SELECT id, title, created_at, updated_at
         FROM sessions
        WHERE id = ?`
    )
    .get(id);
  return row ? rowToSession(row) : null;
}

export function touchSession(id: string): void {
  db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(
    Date.now(),
    id
  );
}

export function deleteSession(id: string): boolean {
  const info = db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
  return info.changes > 0;
}