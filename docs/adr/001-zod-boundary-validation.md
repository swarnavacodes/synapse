# ADR 001: Zod for Boundary Validation

## Status
Accepted

## Context
LLM output is untrusted. Client and server must agree on JSON shapes.

## Decision
Use Zod schemas in `packages/shared`. Server validates all LLM responses before DB mutation. Client optionally validates for dev-time safety.

## Consequences
- Single source of truth for contracts.
- Schema drift prevented.
- Provider-agnostic; any LLM returns JSON validated against the same schema.

## Related
`packages/shared/src/`, `server/src/services/llm/parser.ts`
