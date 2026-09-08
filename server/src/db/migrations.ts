import { db } from "./client.js";

export function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      title       TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS concepts (
      id             TEXT PRIMARY KEY,
      session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      label          TEXT NOT NULL,
      category       TEXT NOT NULL DEFAULT '',
      summary        TEXT NOT NULL DEFAULT '',
      origin         TEXT NOT NULL CHECK (origin IN ('user','llm','derived')),
      source_node_id TEXT REFERENCES concepts(id) ON DELETE SET NULL,
      created_at     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_concepts_session ON concepts(session_id);
    CREATE INDEX IF NOT EXISTS idx_concepts_label   ON concepts(label);

    CREATE TABLE IF NOT EXISTS concept_positions (
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      x REAL NOT NULL,
      y REAL NOT NULL,
      PRIMARY KEY (session_id, concept_id)
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id           TEXT PRIMARY KEY,
      session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      source_id    TEXT NOT NULL REFERENCES concepts(id)   ON DELETE CASCADE,
      target_id    TEXT NOT NULL REFERENCES concepts(id)   ON DELETE CASCADE,
      type         TEXT NOT NULL,
      kind         TEXT NOT NULL CHECK (kind IN ('fact','interpretation','analogy')),
      explanation  TEXT NOT NULL DEFAULT '',
      strength     REAL NOT NULL CHECK (strength >= 0 AND strength <= 1),
      origin       TEXT NOT NULL CHECK (origin IN ('user','llm','derived')),
      created_at   INTEGER NOT NULL,
      CHECK (source_id <> target_id)
    );
    CREATE INDEX IF NOT EXISTS idx_relationships_session ON relationships(session_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_source  ON relationships(source_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_target  ON relationships(target_id);

    CREATE TABLE IF NOT EXISTS exploration_events (
      id             TEXT PRIMARY KEY,
      session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      type           TEXT NOT NULL CHECK (type IN ('seed','expand','connect','challenge','compare')),
      payload        TEXT NOT NULL,
      result_summary TEXT NOT NULL DEFAULT '',
      created_at     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_session ON exploration_events(session_id);

    CREATE TABLE IF NOT EXISTS llm_calls (
      id            TEXT PRIMARY KEY,
      session_id    TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      purpose       TEXT NOT NULL,
      provider      TEXT NOT NULL,
      model         TEXT NOT NULL,
      request_hash  TEXT NOT NULL,
      response      TEXT NOT NULL,
      duration_ms   INTEGER NOT NULL,
      created_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_llm_calls_hash    ON llm_calls(request_hash);
    CREATE INDEX IF NOT EXISTS idx_llm_calls_session ON llm_calls(session_id);
  `);
}