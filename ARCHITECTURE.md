# Thinking Explorer Architecture

Thinking Explorer is a TypeScript monorepo for exploring concepts as an interactive graph. The web client owns the working graph view, while the server owns persistence, validation, and all LLM-backed mutations.

## Recent changes

- **LLM request dedupe.** `generateJson` checks the `llm_calls` cache by `request_hash` before every live call. Cache hits return the stored, re-validated response with `durationMs: 0`; misses fall through to the provider and fallback chain.
- **Seed exploration events.** `POST /api/sessions/:id/concepts` writes a `seed` event for manual concept creation. LLM-originated concepts (with `sourceNodeId`) are skipped — they already emit an `expand` event.
- **Concept search.** The side panel filters concepts by label substring (case-insensitive, local UI state only).

## System Overview

```mermaid
flowchart LR
    User[User]
    Web[Web app<br/>React + Vite + React Flow]
    State[Client state<br/>Zustand]
    API[Express API<br/>REST + Zod validation]
    DB[(SQLite<br/>Graph and session data)]
    LLM[LLM provider<br/>OpenRouter]
    Fallback[Free-model fallback chain]

    User --> Web
    Web <--> State
    Web -->|HTTP /api| API
    API --> DB
    API --> LLM
    LLM --> Fallback
    Fallback --> LLM
```

## Repository Structure

```text
synapse/
├── packages/shared/       Shared Zod schemas and TypeScript contracts
├── server/                Express API and SQLite persistence
│   ├── src/routes/        REST endpoints
│   ├── src/services/      Graph and LLM services
│   └── src/db/            SQLite client, migrations, repositories
├── web/                   React/Vite application
│   └── src/
│       ├── graph/         React Flow canvas, nodes, edges, layout
│       ├── state/         Zustand graph, selection, and filter stores
│       └── features/      Sessions, filters, details, trail, compare, challenge
└── scripts/               Smoke tests and development utilities
```

## Frontend Architecture

```mermaid
flowchart TB
    App[App shell]
    Canvas[React Flow canvas]
    Nodes[Concept nodes and relationship edges]
    Panels[Side panel and feature panels]
    Stores[Zustand stores]
    Client[API client]

    App --> Canvas
    App --> Panels
    Canvas --> Nodes
    App --> Stores
    Canvas --> Stores
    Panels --> Stores
    Stores --> Client
    Client --> API[Express API]
```

The canvas supports:

- Dragging cards and persisting their positions per session.
- Selecting a concept and focusing its neighborhood.
- Filtering concepts and relationships by category, type, and kind.
- Canvas zoom and pan, with popup scrolling isolated from React Flow.
- Fit and reset-layout controls.

User-created standalone concepts remain visible as graph entry points. Disconnected generated or derived concepts are hidden as orphans until they have a visible relationship.

The side panel concept list can be filtered by label substring (case-insensitive, local state only). This composes on top of the category/type/kind filters.

## Server Architecture

```mermaid
flowchart TB
    Routes[Express routes]
    Validation[Shared Zod schemas]
    Graph[Graph service]
    Repos[Repositories]
    SQLite[(SQLite)]
    Provider[LLM provider abstraction]
    OpenRouter[OpenRouter provider]

    Routes --> Validation
    Routes --> Graph
    Graph --> Repos
    Repos --> SQLite
    Routes --> Provider
    Provider --> OpenRouter
    OpenRouter --> Validation
```

The server is the authority for graph mutations. Incoming requests and LLM responses are validated before data is persisted.

## Key Request Flows

### Expand a Concept

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web
    participant S as "Graph store"
    participant E as "Expand route"
    participant L as "OpenRouter provider"
    participant D as SQLite

    U->>W: Click Expand
    W->>S: Set expanding state
    S->>E: "POST expand"
    E->>D: Load seed and neighborhood
    E->>L: Generate structured expansion JSON
    L-->>E: Validated concepts and relationships
    E->>E: Resolve references and ensure parent edges
    E->>D: Persist concepts, edges, event, and LLM call
    E-->>S: Expansion response
    S-->>W: Add returned nodes and edges
```

If the selected OpenRouter model is unavailable, the provider tries the configured fallback models. Timeouts, rate limits, and provider failures are reported as a single upstream error after the fallback chain is exhausted.

### Concept Details

```mermaid
sequenceDiagram
    participant U as User
    participant N as "Concept node"
    participant E as "Details route"
    participant L as "OpenRouter provider"
    participant D as SQLite

    U->>N: Click More details
    N->>E: "GET details"
    E->>D: Load concept neighborhood
    E->>L: Generate structured explanation
    L-->>E: Overview, significance, connections, example
    E-->>N: JSON details response
    N-->>U: Themed details popup
```

## Persistence Model

SQLite stores:

- Sessions and timestamps.
- Concepts, including origin and source concept.
- Relationships, including type, kind, strength, and explanation.
- Per-session concept positions.
- Exploration events (the trail).
- LLM request and response records (audit + dedupe cache).

Concept deletion cascades through relationships and saved positions. Session deletion cascades through all session-owned graph data.

### Exploration events

Every LLM-backed operation writes an `exploration_events` row. Manual concept creation writes a `seed` event; LLM-originated concepts (which set `sourceNodeId`) are skipped because they already emit an `expand` event. The trail view renders these events in `created_at` order.

### LLM call cache

Before every live request, `generateJson` computes a `request_hash` from the normalized input and calls `lookupLLMCall`. On a hit it re-validates the stored response against the caller's schema and returns it with `durationMs: 0`, skipping the provider entirely. On a miss or parse failure it proceeds to the live call (and the fallback chain). Cache hits are never re-written; the original `llm_calls` row is reused.

## Reliability Boundaries

- Shared schemas validate client/server payloads.
- The server validates all LLM output before mutation.
- OpenRouter requests have configurable timeouts.
- Multiple free fallback models can be configured with `OPENROUTER_FALLBACK_MODELS`.
- The frontend clears loading states on both success and failure.
- A React error boundary prevents a graph rendering error from blanking the entire application.

## Development Commands

```powershell
npm install
npm run dev
npm run typecheck
npm run build
node scripts/smoke.mjs
```

The web client runs on `http://localhost:5173` and the API server runs on `http://localhost:4000` by default.
