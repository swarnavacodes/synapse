# Thinking Explorer — Project Plan

> A visual laboratory for exploring ideas. The graph is the primary UI.
> AI proposes; the application owns state.

---

## 1. Current State

`C:\project-2026\synapse` is a **built** TypeScript monorepo (React + Vite + Express + SQLite). Phases 0–6 from this plan are complete; the app runs via `npm run dev`.

The three most recent additions are:

1. **LLM request dedupe** — identical requests are served from the `llm_calls` cache by `request_hash` instead of re-calling OpenRouter.
2. **Seed exploration events** — manual concept creation records a `seed` event in `exploration_events`.
3. **Concept search** — the side panel filters concepts by label substring (local UI state).

See `README.md` for the current state summary and `ARCHITECTURE.md` for request flows.

---

## 2. High-Level Architecture

A small, clearly separated system with one cardinal rule:

> **The LLM is a stateless proposer. It returns structured JSON. The server validates it and is the only thing allowed to mutate the graph.**

```
┌──────────────────────────────────────────────────────────┐
│  Frontend (React + TS + Vite)                            │
│  - React Flow canvas                                     │
│  - Holds working graph state (in-memory)                 │
│  - Calls backend for LLM-backed operations               │
│  - Persists via backend                                  │
└────────────────────────┬─────────────────────────────────┘
                         │  HTTP / JSON
                         ▼
┌──────────────────────────────────────────────────────────┐
│  Backend (Node + TS + Express)                           │
│  - REST API                                              │
│  - Graph state authority (SQLite)                        │
│  - Validation (Zod) of ALL inbound + outbound payloads    │
│  - LLM abstraction layer (provider-agnostic)             │
└────────────────────────┬─────────────────────────────────┘
                         │  OpenRouter
                         ▼
                   ┌──────────────┐
                   │   OpenRouter │
                   └──────────────┘
```

**Key invariants**

1. The LLM **never** mutates DB state directly. It returns JSON; the backend parses, validates, and decides what to persist.
2. The frontend treats LLM output as **untrusted**; even if a prompt injection slipped in, the backend's schema validation is the gatekeeper.
3. All relationships have a **type**, **explanation**, and **strength/confidence**.

---

## 3. Proposed Folder Structure

A monorepo with two packages and a shared schema package. Lightweight, but cleanly separates concerns and allows the LLM contracts to be shared between client and server (single source of truth for the JSON shapes).

```
synapse/
├── README.md
├── PROJECT_PLAN.md
├── package.json                  # workspace root
├── .gitignore
├── .env.example
│
├── packages/
│   └── shared/                   # Shared TS types + Zod schemas
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── concepts.ts
│           ├── relationships.ts
│           ├── graph.ts
│           ├── llm.ts            # LLM request/response shapes
│           └── api.ts            # API request/response shapes
│
├── server/                       # Backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts              # Express bootstrap
│   │   ├── config.ts             # Env + config
│   │   ├── db/
│   │   │   ├── client.ts         # better-sqlite3 connection
│   │   │   ├── migrations.ts     # schema bootstrap
│   │   │   └── repositories/
│   │   │       ├── concepts.ts
│   │   │       ├── relationships.ts
│   │   │       └── sessions.ts
│   │   ├── routes/
│   │   │   ├── concepts.ts
│   │   │   ├── graph.ts
│   │   │   └── explore.ts        # LLM-backed endpoints
│   │   ├── services/
│   │   │   ├── graphService.ts   # business rules
│   │   │   └── llm/
│   │   │       ├── provider.ts   # interface
│   │   │       ├── openrouter.ts # MVP implementation
│   │   │       ├── prompts.ts    # system + user prompt templates
│   │   │       └── parser.ts     # JSON parsing + Zod validation
│   │   └── validation/           # route-level Zod validation
│   └── data/
│       └── synapse.db            # SQLite file (gitignored)
│
└── web/                          # Frontend
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/
        │   └── client.ts         # fetch wrapper, typed against @shared
        ├── state/
        │   ├── graphStore.ts     # Zustand store, single source of UI truth
        │   └── selectionStore.ts
        ├── graph/
        │   ├── Canvas.tsx        # React Flow root
        │   ├── ConceptNode.tsx
        │   ├── RelationshipEdge.tsx
        │   ├── nodeTypes.ts      # registry
        │   ├── edgeTypes.ts
        │   └── layout.ts         # positioning helpers
        ├── features/
        │   ├── explore/          # search/seed a concept
        │   ├── expand/           # expand a node
        │   ├── connect/          # find a bridge between 2 nodes
        │   ├── challenge/        # critique a node/edge
        │   ├── compare/          # side-by-side
        │   └── trail/            # exploration path
        ├── components/           # shared UI (panels, buttons, modals)
        ├── hooks/
        ├── styles/
        │   ├── tokens.css        # design tokens
        │   └── global.css
        └── lib/
            └── types.ts
```

**Why a `shared` package?** The LLM JSON shapes and API contracts are referenced on **both** sides. Sharing the Zod schemas prevents drift and lets us validate at the boundary on the server (and optionally on the client for dev-time safety).

**Tooling choices (small, intentional)**
- **npm workspaces** for the monorepo (no install step, slightly slower/stricter than pnpm).
- **Zod** for all validation (small, ergonomic, TS-native).
- **Zustand** for frontend state (smaller than Redux, fits a graph-centric UI).
- **better-sqlite3** for SQLite (synchronous, simple, ideal for MVP).
- **React Flow** (`@xyflow/react`) for graph visualization.

---

## 4. Data Model (SQLite)

Five tables. All graph mutations go through repositories.

### `sessions`
| column        | type     | notes                          |
|---------------|----------|--------------------------------|
| id            | TEXT PK  | uuid                           |
| title         | TEXT     | optional, user-set             |
| created_at    | INTEGER  | unix ms                        |
| updated_at    | INTEGER  | unix ms                        |

### `concepts`
| column        | type     | notes                                       |
|---------------|----------|---------------------------------------------|
| id            | TEXT PK  | uuid                                        |
| session_id    | TEXT FK  | → sessions.id                               |
| label         | TEXT     | canonical name (e.g. "Consciousness")       |
| category      | TEXT     | free-form tag (philosophy, biology, …)      |
| summary       | TEXT     | 1–3 sentence overview                       |
| origin        | TEXT     | `user` \| `llm` \| `derived`                |
| source_node_id| TEXT FK  | nullable; if derived from expanding a node  |
| created_at    | INTEGER  |                                             |

Indexes: `(session_id)`, `(label)`.

### `relationships`
| column         | type     | notes                                            |
|----------------|----------|--------------------------------------------------|
| id             | TEXT PK  | uuid                                             |
| session_id     | TEXT FK  |                                                  |
| source_id      | TEXT FK  | → concepts.id                                    |
| target_id      | TEXT FK  | → concepts.id                                    |
| type           | TEXT     | e.g. `supports`, `contradicts`, `part_of`, `analogous_to`, `causes`, `requires`, `bridges` |
| kind           | TEXT     | `fact` \| `interpretation` \| `analogy`          |
| explanation    | TEXT     | short rationale                                  |
| strength       | REAL     | 0.0–1.0 (LLM-provided, but server may clamp)     |
| origin         | TEXT     | `llm` \| `user` \| `derived`                     |
| created_at     | INTEGER  |                                                  |

Indexes: `(session_id)`, `(source_id)`, `(target_id)`.

> **No self-loops at the DB layer** — validated in the service layer.

### `exploration_events` (the trail)
| column        | type     | notes                                       |
|---------------|----------|---------------------------------------------|
| id            | TEXT PK  | uuid                                        |
| session_id    | TEXT FK  |                                             |
| type          | TEXT     | `seed` \| `expand` \| `connect` \| `challenge` \| `compare` |
| payload       | TEXT     | JSON blob (validated, narrow schema)        |
| result_summary| TEXT     | short human-readable summary                |
| created_at    | INTEGER  |                                             |

This powers the **exploration path** view.

**Event types in practice:**

- `seed` — emitted by `POST /api/sessions/:id/concepts` when a concept is created manually (no `sourceNodeId`). Payload: `{ conceptId, label }`.
- `expand` — emitted by the expand route when an LLM expansion is persisted. LLM-originated concepts carry `sourceNodeId`, so they are not double-counted as seeds.
- `connect`, `challenge`, `compare` — emitted by their respective routes.

### `llm_calls` (audit + cache)
| column        | type     | notes                                       |
|---------------|----------|---------------------------------------------|
| id            | TEXT PK  | uuid                                        |
| session_id    | TEXT FK  | nullable                                    |
| purpose       | TEXT     | `expand`, `connect`, `challenge`, `compare`, `details` |
| provider      | TEXT     | `openrouter`                                |
| model         | TEXT     | e.g. `anthropic/claude-3.5-sonnet`          |
| request_hash  | TEXT     | sha256 of normalized input (dedupe)         |
| response      | TEXT     | raw JSON                                    |
| duration_ms   | INTEGER  |                                             |
| created_at    | INTEGER  |                                             |

Indexes: `(request_hash)`, `(session_id)`.

**Dedupe behavior:** before every live LLM call, `generateJson` looks up `request_hash` in `llm_calls` (most recent row, `ORDER BY created_at DESC LIMIT 1`). On a hit it re-parses the stored `response` with the caller's schema; if it validates, it returns `{ data, raw: cached.response, model: cached.model, usage: undefined, durationMs: 0 }` — skipping the provider entirely. On a parse failure it falls through to a live call. A cache hit is never re-written; the original row is reused.

---

## 5. API Boundaries (REST, JSON)

All responses are JSON. Errors follow `{ error: { code, message, details? } }`.

### Graph
- `GET  /api/sessions` — list sessions
- `POST /api/sessions` — create session
- `GET  /api/sessions/:id` — full graph (concepts + relationships + events)
- `DELETE /api/sessions/:id` — delete session

### Mutations (user-driven, no LLM)
- `POST /api/sessions/:id/concepts` — manually add a concept
- `POST /api/sessions/:id/relationships` — manually add a relationship
- `DELETE /api/sessions/:id/concepts/:conceptId` — remove a concept + cascading edges

### LLM-backed operations
- `POST /api/sessions/:id/expand`
  - body: `{ nodeId, depth?: 1|2, focus?: string }`
  - returns: `{ concepts: Concept[], relationships: Relationship[] }`
  - server: fetches node context, calls LLM, validates Zod schema, persists, returns.
- `POST /api/sessions/:id/connect`
  - body: `{ fromNodeId, toNodeId, maxBridges?: number }`
  - returns: `{ bridges: BridgeProposal[] }` where a bridge is a new concept with edges to both.
- `POST /api/sessions/:id/challenge`
  - body: `{ target: { kind: 'concept'|'relationship', id } }`
  - returns: `{ critiques: Critique[] }` — **does not** mutate the graph; the user can choose to act.
- `POST /api/sessions/:id/compare`
  - body: `{ aNodeId, bNodeId, axes?: string[] }`
  - returns: `{ axes: CompareAxis[], summary: string }`
- `GET  /api/sessions/:id/trail` — list of `exploration_events`, ordered.

### Health
- `GET  /api/health` — `{ ok: true, version }`

**Validation principle:** every LLM-driven endpoint runs the LLM output through a Zod schema **before** anything is written to the DB. If validation fails, the server returns a structured error and does **not** partially persist.

---

## 6. Frontend Component Architecture

```
<App>
 ├── <TopBar/>                // session title, actions
 ├── <Canvas>                 // React Flow
 │    ├── <Background/>
 │    ├── <MiniMap/>
 │    ├── <Controls/>
 │    ├── nodeTypes
 │    │    ├── <ConceptNode/>  // pill w/ label, category chip, expand button
 │    │    └── <BridgeNode/>   // visually distinct for connect proposals
 │    └── edgeTypes
 │         └── <RelationshipEdge/>  // styled by type + kind
 ├── <SidePanel>              // context-sensitive
 │    ├── <NodeInspector/>     // when a node is selected
 │    ├── <EdgeInspector/>
 │    └── <TrailPanel/>        // exploration path
 ├── <CommandPalette/>         // ⌘K — explore / expand / connect / challenge / compare
 └── <CompareModal/>           // for compare view
```

**State**
- `graphStore` (Zustand): `{ concepts, relationships, events }` + actions (`addConcepts`, `addRelationships`, `removeCascade`, `applyProposal`).
- `selectionStore`: `selectedNodeId | selectedEdgeId | null`.
- LLM calls are made via the API client; the **backend returns finalized mutations** the store applies atomically. This keeps the invariant: the LLM never tells the client "do X to the graph" — the server has already done it.

**Visual uncluttering (the "feel" requirement)**
- Nodes are compact pills with a colored category dot.
- Edges vary stroke style by `kind` (fact = solid, interpretation = dashed, analogy = dotted).
- Strength controls edge opacity/thickness.
- A "Focus" mode fades everything outside 1-hop of the selected node.
- Edge labels are hidden by default; appear on hover or selection.

**Concept search (side panel)**
- A text input above the concept list filters concepts by case-insensitive substring match on `label`.
- Filtering is local UI state only — no API call. It composes on top of the existing category/type/kind filters.

---

## 7. LLM Abstraction

A single interface with one MVP implementation. Designed so swapping to Anthropic/OpenAI/local is a new file in `server/src/services/llm/`.

```ts
// provider.ts
export interface LLMProvider {
  readonly name: string;        // "openrouter"
  generateJson<T>(req: LLMRequest, schema: ZodSchema<T>): Promise<LLMResult<T>>;
}

export interface LLMRequest {
  purpose: 'expand' | 'connect' | 'challenge' | 'compare';
  system: string;               // from prompts.ts
  user: string;                 // serialized graph context
  model?: string;               // override per call
  temperature?: number;
}

export interface LLMResult<T> {
  data: T;                      // validated
  raw: string;                  // for audit
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
  durationMs: number;
}
```

**Why this shape?**
- `generateJson` takes the **Zod schema** as an argument. The provider is responsible for telling the model to return JSON and for parsing + validating it. This keeps every LLM call type-safe.
- `system` and `user` are pre-built by `prompts.ts`; the provider does no prompt engineering.
- The provider also computes `request_hash` and writes an `llm_calls` row for audit + dedupe.

**Cache-first behavior:** before making a live request, `generateJson` calls `lookupLLMCall(requestHash)`. On a hit it re-validates the stored response against the caller's schema and returns it with `durationMs: 0`. On a miss or parse failure it proceeds to the live call (and the fallback chain). Cache hits are never re-written.

**Prompt strategy (MVP)**
- One system prompt per `purpose` with strict JSON-only instructions.
- A small set of "graph context serializers" that turn `{node, 1-hop neighborhood}` into compact text.
- All prompts request fields matching the Zod schemas (concept shape, relationship shape, etc.).

**Configuration**
- `OPENROUTER_API_KEY` in `.env`.
- `OPENROUTER_MODEL` default e.g. `anthropic/claude-3.5-sonnet` (user can swap).
- `OPENROUTER_BASE_URL` overridable.

---

## 8. Architectural Risks

1. **LLM JSON unreliability.** Mitigated by Zod validation + a retry-with-stricter-prompt path. We never blindly trust the LLM.
2. **Graph sprawl.** A naïve render of N nodes is fine, but interaction gets messy. Mitigated by Focus mode, edge label hiding, and a "compact" node variant. Considered but deferred: clustering, semantic zoom.
3. **Latency on LLM calls.** The UI must remain responsive. Mitigated with optimistic skeletons ("Expanding…") and streaming only if we add it later (out of scope for MVP).
4. **Cost / rate limits.** A `request_hash` cache + per-session usage logs in `llm_calls` give us observability from day one.
5. **SQLite concurrency.** fine-sqlite3 is fine for a single-process server. If we ever need concurrency, swap to a different driver — repositories are the only files that touch the DB.
6. **Prompt injection / malicious input.** A user typing "Ignore previous instructions…" can only affect the *content* of new concepts/relationships, not the system's ability to enforce its own schema. Zod at the boundary is the guard.
7. **Workspace complexity.** A monorepo is a small upfront tax. We accept it because the shared schema is genuinely shared. If we ever want to flatten, the move is mechanical.
8. **React Flow scope creep.** We're sticking to core features: custom node/edge types, fitView, controls, minimap. No plugins unless we need them.

---

## 9. Implementation Phases

Each phase is independently testable. After each phase, the app remains runnable.

### Phase 0 — Bootstrap (no business logic)
- pnpm workspace, shared/server/web packages, TS configs, lint/format, `.env.example`, `.gitignore`, README.
- `GET /api/health`, "Hello" page on the web.
- **Done when:** `npm dev` runs both, health check returns ok.
- **Status: complete** (implemented with npm workspaces instead of pnpm).

### Phase 1 — Data layer + graph state (no LLM)
- SQLite schema + migrations + repositories.
- Manual `POST /concepts`, `POST /relationships`, `GET /sessions/:id`.
- Frontend renders a hard-coded graph on React Flow.
- `graphStore` wired to API.
- **Done when:** I can create concepts/relationships in the UI and reload — they persist.
- **Status: complete**

### Phase 2 — LLM provider + Explore (seed) + Expand
- `LLMProvider` interface, OpenRouter impl, prompt templates, Zod schemas for concept/relationship output.
- `POST /expand` end-to-end.
- Frontend: "Explore" via command palette, expand button on node, Focus mode.
- **Done when:** I can expand a node and see new concepts/edges appear, persisted, and reloadable.
- **Status: complete**

### Phase 3 — Connect (bridges)
- `POST /connect` with bridge-proposal schema.
- Frontend: multi-select two nodes, "Find bridges" action, preview then accept.
- **Done when:** I can connect two unrelated concepts and accept a proposed bridge.
- **Status: complete**

### Phase 4 — Challenge + Compare
- `POST /challenge` returns critiques; UI shows them in a side panel without mutating the graph unless the user accepts.
- `POST /compare` returns axes; rendered in a side-by-side modal.
- **Done when:** Both flows work end-to-end.
- **Status: complete**

### Phase 5 — Trail (exploration path)
- All LLM-backed routes write `exploration_events`.
- `GET /trail` + `TrailPanel` showing the user's path; click an event to re-focus the canvas.
- **Done when:** I can see and replay my session's path.
- **Status: complete** — manual concept creation also writes a `seed` event.

### Phase 6 — Polish
- Visual polish: tokens, animations, empty/loading/error states, edge label-on-hover.
- Basic observability panel (recent `llm_calls`, durations, errors).
- **Done when:** The app feels like a "beautiful, modern, interactive intellectual exploration canvas."
- **Status: complete**

### Phase 7 — Reliability (added after polish)
- **LLM request dedupe.** Identical requests are served from the `llm_calls` cache by `request_hash`; see the `llm_calls` table and the cache-first behavior in §7.
- **Concept search.** The side panel filters concepts by label substring (case-insensitive, local UI state only, no API call).

---

## 10. Decisions (as built)

These are the decisions from the original plan, recorded with the choice actually made:

1. **Monorepo with `shared` package** — adopted. Client and server share Zod schemas.
2. **Workspace manager** — npm workspaces (not pnpm). No install step, slightly slower.
3. **Zustand** for frontend state.
4. **better-sqlite3** (synchronous).
5. **React Flow** (`@xyflow/react`).
6. **OpenRouter default model** — configurable via `OPENROUTER_MODEL` in `server/src/config.ts`.
7. **Phase ordering** — followed as written.
8. **Scope cuts honored** — no auth/multi-user, no streaming LLM responses, no graph clustering/auto-layout beyond simple positioning, no test suite beyond smoke tests.
9. **Naming** — folder `synapse`, app name "Thinking Explorer".

### Deviations from the plan

- The `llm_calls` cache is checked **before** every live call (cache-first), not just written for audit. The plan anticipated dedupe; this implements it at the provider boundary.
- Manual concept creation writes a `seed` exploration event, which the original plan did not call out explicitly.
