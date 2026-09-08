# Thinking Explorer

A visual laboratory for exploring ideas. The graph is the primary UI.

> **The LLM is a stateless proposer. It returns structured JSON. The server validates it and is the only thing allowed to mutate the graph.**

## Architecture

A TypeScript monorepo with three packages:

- `packages/shared` — Zod schemas and TypeScript contracts shared by client and server.
- `server` — Express REST API, SQLite persistence, OpenRouter LLM provider.
- `web` — React + Vite + React Flow canvas.

```
User → Web (React Flow) → Express API → SQLite
                         ↘ OpenRouter (LLM)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for request flows and [PROJECT_PLAN.md](PROJECT_PLAN.md) for the implementation roadmap.

## Getting started

```powershell
npm install
npm run dev
```

- Web client: <http://localhost:5173>
- API server: <http://localhost:4000>

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start both servers |
| `npm run typecheck` | Type-check all workspaces |
| `npm run build` | Build all packages |
| `npm test` | Run unit test suites (Vitest) across all workspaces |
| `node scripts/smoke.mjs` | Run smoke tests |

## Configuration

Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY`. See `server/src/config.ts` for all options.

## Data model

SQLite tables: `sessions`, `concepts`, `relationships`, `exploration_events`, `llm_calls`. See [PROJECT_PLAN.md §4](PROJECT_PLAN.md#4-data-model-sqlite) for the full schema.

## Recent changes

- **LLM request dedupe.** Identical LLM requests are served from the `llm_calls` cache by `request_hash` instead of calling OpenRouter again. Cache hits skip the provider and return the stored, re-validated response.
- **Seed exploration events.** Manually creating a concept now records a `seed` event in `exploration_events`. LLM-originated concepts (which set `sourceNodeId`) are skipped — they already emit an `expand` event.
- **Concept search.** The side panel filters the concept list by label substring (case-insensitive, local state only).