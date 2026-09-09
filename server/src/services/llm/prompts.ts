import type { Concept, LLMRequest, Relationship } from "@thinking-explorer/shared";

export interface ExpandContext {
  seed: Concept;
  neighbors: Concept[];
  neighborhoodEdges: Relationship[];
  depth: 1 | 2;
  focus?: string;
}

export interface ConnectContext {
  from: Concept;
  to: Concept;
  fromNeighbors: Concept[];
  toNeighbors: Concept[];
  fromEdges: Relationship[];
  toEdges: Relationship[];
  maxBridges: number;
}

export interface ConceptDetailsContext {
  concept: Concept;
  neighbors: Array<{ label: string; category?: string; summary?: string }>;
  relationships: Array<{ otherLabel: string; type: string; kind: string; explanation: string }>;
}

export interface ConceptQAContext {
  concept: Concept;
  neighbors: Array<{ label: string; category?: string; summary?: string }>;
  relationships: Array<{ otherLabel: string; type: string; kind: string; explanation: string }>;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  question: string;
}

const SYSTEM_PROMPT = `You expand a single concept into a small, focused sub-graph.

Hard rules:
- Output STRICT JSON only. No commentary, no markdown fences.
- Schema:
  {
    "concepts": [
      { "label": string, "category"?: string, "summary"?: string }
    ],
    "relationships": [
      {
        "sourceRef": string,
        "targetRef": string,
        "type": "supports"|"contradicts"|"part_of"|"analogous_to"|"causes"|"requires"|"bridges"|"related_to",
        "kind": "fact"|"interpretation"|"analogy",
        "explanation"?: string,
        "strength": number  // 0..1
      }
    ]
  }
- Emit between 3 and 8 new concepts. Each must be clearly distinct and add information.
- For sourceRef/targetRef use:
    - "seed" to refer to the original concept being expanded, OR
    - the exact "label" of a concept you just emitted in this same response.
- Never reference a label that does not appear in your own "concepts" array (or "seed").
- Every emitted concept should appear in at least one relationship.
- Every emitted concept must have at least one relationship directly to "seed" so the expanded graph remains connected to the parent.
- strength is 0..1; use values like 0.4-0.9 typically. Never use exactly 0 or 1.
- Prefer precise, non-obvious connections over generic ones.`;

function serializeNeighborhood(
  seed: Concept,
  neighbors: Concept[],
  edges: Relationship[]
): string {
  const lines: string[] = [];
  lines.push(`# Seed concept`);
  lines.push(`label: ${seed.label}`);
  if (seed.category) lines.push(`category: ${seed.category}`);
  if (seed.summary) lines.push(`summary: ${seed.summary}`);
  if (neighbors.length === 0) {
    lines.push(`\n# Immediate neighborhood\n(none — this is a brand-new concept)`);
  } else {
    lines.push(`\n# Immediate neighborhood (1-hop)`);
    for (const n of neighbors) {
      lines.push(`- ${n.label}${n.category ? ` [${n.category}]` : ""}${n.summary ? ` — ${n.summary}` : ""}`);
    }
    if (edges.length > 0) {
      lines.push(`\n# Known relationships to neighbours`);
      for (const e of edges) {
        const src = e.sourceId === seed.id ? "seed" : neighbors.find((n) => n.id === e.sourceId)?.label ?? "?";
        const tgt = e.targetId === seed.id ? "seed" : neighbors.find((n) => n.id === e.targetId)?.label ?? "?";
        lines.push(`- ${src} -[${e.type}/${e.kind}, strength=${e.strength.toFixed(2)}]-> ${tgt}${e.explanation ? ` (${e.explanation})` : ""}`);
      }
    }
  }
  return lines.join("\n");
}

export function buildExpandPrompt(ctx: ExpandContext): LLMRequest {
  const userLines = [
    `Depth: ${ctx.depth}`,
    ctx.focus ? `Focus: ${ctx.focus}` : null,
    "",
    serializeNeighborhood(ctx.seed, ctx.neighbors, ctx.neighborhoodEdges),
    "",
    "Return ONLY the JSON object described in the system prompt.",
  ].filter((l) => l !== null) as string[];

  return {
    purpose: "expand",
    system: SYSTEM_PROMPT,
    user: userLines.join("\n"),
  };
}

const CONCEPT_DETAILS_SYSTEM_PROMPT = `You are an expert explainer.

Explain the subject itself, not the application or user interface.

Rules:
- Return strict JSON only.
- Do not mention cards, graphs, nodes, prompts, users, or software.
- Define the subject precisely in plain language.
- Explain why it matters or what it helps us understand.
- Use the supplied neighboring concepts and relationships when they add real context.
- Include one concrete, accurate example.
- Avoid vague filler such as "this concept explores" or "in everyday life".
- Do not invent specific facts when the supplied context is insufficient.

Return exactly:
{
  "overview": "A precise explanation of the subject.",
  "significance": "Why the subject matters.",
  "connections": "How it relates to the supplied neighboring ideas.",
  "example": "One concrete example."
}`;

export function buildConceptDetailsPrompt(ctx: ConceptDetailsContext): LLMRequest {
  const neighbors = ctx.neighbors.length === 0
    ? "(none)"
    : ctx.neighbors.map((n) => `- ${n.label}${n.category ? ` [${n.category}]` : ""}${n.summary ? ` — ${n.summary}` : ""}`).join("\n");
  const relationships = ctx.relationships.length === 0
    ? "(none)"
    : ctx.relationships.map((r) => `- ${r.type}/${r.kind} with ${r.otherLabel}${r.explanation ? `: ${r.explanation}` : ""}`).join("\n");
  return {
    purpose: "details",
    system: CONCEPT_DETAILS_SYSTEM_PROMPT,
    user: [
      `Subject: ${ctx.concept.label}`,
      `Category: ${ctx.concept.category || "Uncategorized"}`,
      `Summary: ${ctx.concept.summary || "No summary supplied."}`,
      "",
      "Neighboring concepts:",
      neighbors,
      "",
      "Relationships:",
      relationships,
    ].join("\n"),
  };
}

const CONCEPT_QA_SYSTEM_PROMPT = `You answer follow-up questions about a concept within an intellectual idea exploration graph.

Rules:
- Return STRICT JSON only. No commentary, no markdown fences.
- Schema:
  {
    "answer": string
  }
- Answer the user's question directly, clearly, and concisely (1-3 paragraphs).
- Ground your answer in the concept and its contextual relationships when relevant.
- Do not mention user interfaces, cards, JSON, prompts, or software.
- Be accurate, intellectually substantive, and accessible.`;

export function buildConceptQAPrompt(ctx: ConceptQAContext): LLMRequest {
  const neighbors = ctx.neighbors.length === 0
    ? "(none)"
    : ctx.neighbors.map((n) => `- ${n.label}${n.category ? ` [${n.category}]` : ""}${n.summary ? ` — ${n.summary}` : ""}`).join("\n");
  const relationships = ctx.relationships.length === 0
    ? "(none)"
    : ctx.relationships.map((r) => `- ${r.type}/${r.kind} with ${r.otherLabel}${r.explanation ? `: ${r.explanation}` : ""}`).join("\n");

  const lines: string[] = [
    `Subject: ${ctx.concept.label}`,
    `Category: ${ctx.concept.category || "Uncategorized"}`,
    `Summary: ${ctx.concept.summary || "No summary supplied."}`,
    "",
    "Neighboring concepts:",
    neighbors,
    "",
    "Relationships:",
    relationships,
  ];

  if (ctx.history.length > 0) {
    lines.push("", "Conversation history:");
    for (const msg of ctx.history) {
      lines.push(`${msg.role === "user" ? "User" : "Assistant"}: ${msg.text}`);
    }
  }

  lines.push("", `Follow-up question: ${ctx.question}`);
  lines.push("", "Return ONLY the JSON object with the \"answer\" field.");

  return {
    purpose: "qa",
    system: CONCEPT_QA_SYSTEM_PROMPT,
    user: lines.join("\n"),
  };
}

const CONNECT_SYSTEM_PROMPT = `You propose bridging concepts that meaningfully connect two distinct ideas.

Hard rules:
- Output STRICT JSON only. No commentary, no markdown fences.
- Schema:
  {
    "bridges": [
      {
        "label": string,
        "category"?: string,
        "summary"?: string,
        "fromRelationship": {
          "type": "supports"|"contradicts"|"part_of"|"analogous_to"|"causes"|"requires"|"bridges"|"related_to",
          "kind": "fact"|"interpretation"|"analogy",
          "explanation"?: string,
          "strength": number  // 0..1
        },
        "toRelationship": {
          "type": "supports"|"contradicts"|"part_of"|"analogous_to"|"causes"|"requires"|"bridges"|"related_to",
          "kind": "fact"|"interpretation"|"analogy",
          "explanation"?: string,
          "strength": number
        }
      }
    ]
  }
- Emit between 1 and 5 bridges. Each must be a genuinely distinct concept that connects the two seeds.
- "fromRelationship" links the bridge to the FROM concept; "toRelationship" links it to the TO concept.
- Prefer concepts that are not just generic categories but specific mechanisms, theories, or phenomena.
- strength is 0..1; use values like 0.4-0.9. Never use exactly 0 or 1.
- The explanation should briefly justify why this bridge makes sense.
- Each bridge should be able to stand alone as a meaningful concept in its own right.`;

function serializeConceptWithNeighbors(
  concept: Concept,
  neighbors: Concept[],
  edges: Relationship[],
  label: string
): string {
  const lines: string[] = [];
  lines.push(`# ${label} concept`);
  lines.push(`label: ${concept.label}`);
  if (concept.category) lines.push(`category: ${concept.category}`);
  if (concept.summary) lines.push(`summary: ${concept.summary}`);
  if (neighbors.length === 0) {
    lines.push(`\n# Immediate neighborhood\n(none)`);
  } else {
    lines.push(`\n# Immediate neighborhood (1-hop)`);
    for (const n of neighbors) {
      lines.push(`- ${n.label}${n.category ? ` [${n.category}]` : ""}${n.summary ? ` — ${n.summary}` : ""}`);
    }
    if (edges.length > 0) {
      lines.push(`\n# Known relationships to neighbours`);
      for (const e of edges) {
        const src = e.sourceId === concept.id ? label : neighbors.find((n) => n.id === e.sourceId)?.label ?? "?";
        const tgt = e.targetId === concept.id ? label : neighbors.find((n) => n.id === e.targetId)?.label ?? "?";
        lines.push(`- ${src} -[${e.type}/${e.kind}, strength=${e.strength.toFixed(2)}]-> ${tgt}${e.explanation ? ` (${e.explanation})` : ""}`);
      }
    }
  }
  return lines.join("\n");
}

export function buildConnectPrompt(ctx: ConnectContext): LLMRequest {
  const userLines = [
    `Max bridges: ${ctx.maxBridges}`,
    "",
    serializeConceptWithNeighbors(ctx.from, ctx.fromNeighbors, ctx.fromEdges, "FROM"),
    "",
    serializeConceptWithNeighbors(ctx.to, ctx.toNeighbors, ctx.toEdges, "TO"),
    "",
    "Return ONLY the JSON object described in the system prompt.",
  ];

  return {
    purpose: "connect",
    system: CONNECT_SYSTEM_PROMPT,
    user: userLines.join("\n"),
  };
}

export interface ChallengeContext {
  targetKind: "concept" | "relationship";
  targetLabel: string;
  targetSummary: string;
  category?: string;
  relationships: Array<{
    type: string;
    kind: string;
    explanation?: string;
    strength: number;
    otherLabel: string;
  }>;
}

const CHALLENGE_SYSTEM_PROMPT = `You critique a concept or relationship, identifying weaknesses, gaps, or alternative perspectives.

Hard rules:
- Output STRICT JSON only. No commentary, no markdown fences.
- Schema:
  {
    "critiques": [
      {
        "text": string,        // the critique itself (1-3 sentences)
        "severity": "minor"|"moderate"|"significant",
        "aspect": string       // e.g. "logic", "evidence", "completeness", "framing"
      }
    ]
  }
- Emit between 2 and 5 critiques.
- Be specific and constructive. Identify concrete issues, not vague hand-waving.
- severity should reflect how seriously the issue affects the concept's validity or usefulness.
- Each critique should focus on a distinct aspect.`;

function serializeChallengeContext(ctx: ChallengeContext): string {
  const lines: string[] = [];
  lines.push(`# Target (${ctx.targetKind})`);
  lines.push(`label: ${ctx.targetLabel}`);
  if (ctx.category) lines.push(`category: ${ctx.category}`);
  if (ctx.targetSummary) lines.push(`summary: ${ctx.targetSummary}`);
  if (ctx.relationships.length > 0) {
    lines.push(`\n# Existing relationships`);
    for (const r of ctx.relationships) {
      lines.push(`- ${ctx.targetLabel} -[${r.type}/${r.kind}, strength=${r.strength.toFixed(2)}]-> ${r.otherLabel}${r.explanation ? ` (${r.explanation})` : ""}`);
    }
  }
  return lines.join("\n");
}

export function buildChallengePrompt(ctx: ChallengeContext): LLMRequest {
  return {
    purpose: "challenge",
    system: CHALLENGE_SYSTEM_PROMPT,
    user: serializeChallengeContext(ctx),
  };
}

export interface CompareContext {
  a: {
    label: string;
    category?: string;
    summary?: string;
    relationships: Array<{ type: string; kind: string; explanation?: string; strength: number; otherLabel: string }>;
  };
  b: {
    label: string;
    category?: string;
    summary?: string;
    relationships: Array<{ type: string; kind: string; explanation?: string; strength: number; otherLabel: string }>;
  };
  axes?: string[];
}

const COMPARE_SYSTEM_PROMPT = `You compare two concepts along meaningful axes of comparison.

Hard rules:
- Output STRICT JSON only. No commentary, no markdown fences.
- Schema:
  {
    "axes": [
      {
        "axis": string,    // the dimension being compared (e.g. "Abstraction level", "Evidence base")
        "aValue": string,  // how concept A scores on this axis
        "bValue": string   // how concept B scores on this axis
      }
    ],
    "summary": string  // 1-3 sentence overall comparison conclusion
  }
- Emit between 3 and 6 axes.
- Each axis should be genuinely meaningful for distinguishing these two concepts.
- axes are auto-provided if the user specifies them; otherwise choose your own meaningful axes.
- aValue and bValue should be short (1 phrase each).
- summary should draw a clear conclusion about how these concepts differ and relate.`;

function serializeCompareContext(ctx: CompareContext): string {
  const lines: string[] = [];
  lines.push("# Concept A");
  lines.push(`label: ${ctx.a.label}`);
  if (ctx.a.category) lines.push(`category: ${ctx.a.category}`);
  if (ctx.a.summary) lines.push(`summary: ${ctx.a.summary}`);
  if (ctx.a.relationships.length > 0) {
    lines.push(`relationships: ${ctx.a.relationships.map(r => `${ctx.a.label} -[${r.type}/${r.kind}]-> ${r.otherLabel}`).join(", ")}`);
  }
  lines.push("\n# Concept B");
  lines.push(`label: ${ctx.b.label}`);
  if (ctx.b.category) lines.push(`category: ${ctx.b.category}`);
  if (ctx.b.summary) lines.push(`summary: ${ctx.b.summary}`);
  if (ctx.b.relationships.length > 0) {
    lines.push(`relationships: ${ctx.b.relationships.map(r => `${ctx.b.label} -[${r.type}/${r.kind}]-> ${r.otherLabel}`).join(", ")}`);
  }
  if (ctx.axes && ctx.axes.length > 0) {
    lines.push(`\n# Requested axes: ${ctx.axes.join(", ")}`);
  }
  return lines.join("\n");
}

export function buildComparePrompt(ctx: CompareContext): LLMRequest {
  return {
    purpose: "compare",
    system: COMPARE_SYSTEM_PROMPT,
    user: serializeCompareContext(ctx),
  };
}

export interface ExportSummaryContext {
  title: string | null;
  concepts: Array<{ label: string; category?: string; summary?: string; origin: string }>;
  relationships: Array<{ sourceLabel: string; targetLabel: string; type: string; kind: string; explanation?: string }>;
  expandedConceptCount: number;
}

const EXPORT_SUMMARY_SYSTEM_PROMPT = `You write a comprehensive narrative summary of an intellectual exploration session.

Hard rules:
- Output STRICT JSON only. No commentary, no markdown fences.
- Schema:
  {
    "narrative": string  // A 500-700 word narrative in markdown format
  }
- The narrative should be 500-700 words long, scaled based on session depth and complexity.
- Write in clear, accessible prose that captures the intellectual journey.
- Highlight key themes, important relationships, and insights that emerged.
- For sessions with many expanded concepts (those with summaries), provide deeper analysis.
- For sessions with fewer expanded concepts, focus on the overall structure and connections.
- Use markdown formatting: headers, bold, lists where appropriate.
- Do not mention the software, UI, or technical implementation.
- Focus on the ideas themselves and how they connect.
- Be substantive and intellectually engaging.`;

function serializeExportContext(ctx: ExportSummaryContext): string {
  const lines: string[] = [];
  lines.push(`# Session: ${ctx.title || "Untitled"}`);
  lines.push(`Total concepts: ${ctx.concepts.length}`);
  lines.push(`Expanded concepts (with summaries): ${ctx.expandedConceptCount}`);
  lines.push(`Total relationships: ${ctx.relationships.length}`);
  
  const categories = [...new Set(ctx.concepts.map(c => c.category).filter(Boolean))];
  if (categories.length > 0) {
    lines.push(`Categories: ${categories.join(", ")}`);
  }
  
  lines.push("\n## Concepts");
  for (const c of ctx.concepts) {
    const cat = c.category ? ` [${c.category}]` : "";
    const summary = c.summary ? ` — ${c.summary}` : "";
    const origin = c.origin !== "user" ? ` (${c.origin})` : "";
    lines.push(`- ${c.label}${cat}${origin}${summary}`);
  }
  
  lines.push("\n## Key Relationships");
  for (const r of ctx.relationships.slice(0, 15)) {
    const expl = r.explanation ? ` — ${r.explanation}` : "";
    lines.push(`- ${r.sourceLabel} —[${r.type}]→ ${r.targetLabel}${expl}`);
  }
  if (ctx.relationships.length > 15) {
    lines.push(`... and ${ctx.relationships.length - 15} more relationships`);
  }
  
  lines.push("\nWrite a 500-700 word narrative summary that synthesizes this exploration.");
  lines.push("Return ONLY the JSON object with the \"narrative\" field containing markdown text.");
  
  return lines.join("\n");
}

export function buildExportSummaryPrompt(ctx: ExportSummaryContext): LLMRequest {
  return {
    purpose: "export-summary",
    system: EXPORT_SUMMARY_SYSTEM_PROMPT,
    user: serializeExportContext(ctx),
  };
}
