import { db } from "../client.js";

export type Position = { x: number; y: number };

export function listPositionsBySession(sessionId: string): Record<string, Position> {
  const rows = db
    .prepare<[string], { concept_id: string; x: number; y: number }>(
      `SELECT concept_id, x, y FROM concept_positions WHERE session_id = ?`
    )
    .all(sessionId);
  return Object.fromEntries(rows.map((row) => [row.concept_id, { x: row.x, y: row.y }]));
}

export function savePositions(sessionId: string, positions: Record<string, Position>): void {
  const statement = db.prepare(
    `INSERT INTO concept_positions (session_id, concept_id, x, y)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (session_id, concept_id) DO UPDATE SET x = excluded.x, y = excluded.y`
  );
  const transaction = db.transaction(() => {
    for (const [conceptId, position] of Object.entries(positions)) {
      statement.run(sessionId, conceptId, position.x, position.y);
    }
  });
  transaction();
}