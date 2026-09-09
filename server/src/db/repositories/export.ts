import type { Concept, Relationship, ExportSummary } from "@thinking-explorer/shared";

export async function buildExportSummary(
  session: { id: string; title: string | null; createdAt: number; updatedAt: number },
  concepts: Concept[],
  relationships: Relationship[],
  generateNarrative?: (context: {
    title: string | null;
    concepts: Array<{ label: string; category?: string; summary?: string; origin: string }>;
    relationships: Array<{ sourceLabel: string; targetLabel: string; type: string; kind: string; explanation?: string }>;
    expandedConceptCount: number;
  }) => Promise<string | null>
): Promise<ExportSummary> {
  const conceptById = new Map(concepts.map((c) => [c.id, c]));

  const enrichedRelationships = relationships.map((r) => ({
    id: r.id,
    sourceLabel: conceptById.get(r.sourceId)?.label ?? "Unknown",
    targetLabel: conceptById.get(r.targetId)?.label ?? "Unknown",
    type: r.type,
    kind: r.kind,
    explanation: r.explanation || undefined,
    strength: r.strength,
  }));

  const expandedConceptCount = concepts.filter((c) => c.summary && c.summary.length > 0).length;

  let narrative: string;
  if (generateNarrative) {
    const narrativeContext = {
      title: session.title,
      concepts: concepts.map((c) => ({
        label: c.label,
        category: c.category || undefined,
        summary: c.summary || undefined,
        origin: c.origin,
      })),
      relationships: enrichedRelationships.map((r) => ({
        sourceLabel: r.sourceLabel,
        targetLabel: r.targetLabel,
        type: r.type,
        kind: r.kind,
        explanation: r.explanation,
      })),
      expandedConceptCount,
    };
    const llmNarrative = await generateNarrative(narrativeContext);
    
    if (llmNarrative) {
      narrative = llmNarrative;
    } else {
      const conceptLabels = concepts.map((c) => c.label);
      const connectionLines = enrichedRelationships
        .map((r) => `${r.sourceLabel} —[${r.type}]→ ${r.targetLabel}`)
        .join("\n");

      const categories = [...new Set(concepts.map((c) => c.category).filter(Boolean))];
      const originCounts = {
        user: concepts.filter((c) => c.origin === "user").length,
        llm: concepts.filter((c) => c.origin === "llm").length,
        derived: concepts.filter((c) => c.origin === "derived").length,
      };

      narrative = buildNarrative({
        title: session.title,
        conceptCount: concepts.length,
        relationshipCount: relationships.length,
        categories,
        originCounts,
        conceptLabels,
        connectionLines,
      });
    }
  } else {
    const conceptLabels = concepts.map((c) => c.label);
    const connectionLines = enrichedRelationships
      .map((r) => `${r.sourceLabel} —[${r.type}]→ ${r.targetLabel}`)
      .join("\n");

    const categories = [...new Set(concepts.map((c) => c.category).filter(Boolean))];
    const originCounts = {
      user: concepts.filter((c) => c.origin === "user").length,
      llm: concepts.filter((c) => c.origin === "llm").length,
      derived: concepts.filter((c) => c.origin === "derived").length,
    };

    narrative = buildNarrative({
      title: session.title,
      conceptCount: concepts.length,
      relationshipCount: relationships.length,
      categories,
      originCounts,
      conceptLabels,
      connectionLines,
    });
  }

  return {
    session: {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    conceptCount: concepts.length,
    relationshipCount: relationships.length,
    concepts: concepts.map((c) => ({
      id: c.id,
      label: c.label,
      category: c.category || undefined,
      summary: c.summary || undefined,
      origin: c.origin,
    })),
    relationships: enrichedRelationships,
    qaSynthesis: [],
    narrative,
    exportedAt: Date.now(),
  };
}

function buildNarrative({
  title,
  conceptCount,
  relationshipCount,
  categories,
  originCounts,
  conceptLabels,
  connectionLines,
}: {
  title: string | null;
  conceptCount: number;
  relationshipCount: number;
  categories: string[];
  originCounts: Record<string, number>;
  conceptLabels: string[];
  connectionLines: string;
}): string {
  const parts: string[] = [];

  const sessionLabel = title ? `Session "${title}"` : "Untitled session";
  parts.push(`# ${sessionLabel}`);
  parts.push("");
  parts.push(`This session contains **${conceptCount} concepts** and **${relationshipCount} relationships** connecting them.`);
  parts.push("");

  if (categories.length > 0) {
    parts.push(`**Categories:** ${categories.join(", ")}`);
  }
  if (originCounts.user > 0 || originCounts.llm > 0 || originCounts.derived > 0) {
    const origins: string[] = [];
    if (originCounts.user) origins.push(`${originCounts.user} user-created`);
    if (originCounts.llm) origins.push(`${originCounts.llm} AI-generated`);
    if (originCounts.derived) origins.push(`${originCounts.derived} derived`);
    parts.push(`**Origins:** ${origins.join(", ")}`);
  }
  parts.push("");

  parts.push("## Concepts");
  for (const label of conceptLabels) {
    parts.push(`- ${label}`);
  }
  parts.push("");

  if (connectionLines) {
    parts.push("## Connections");
    parts.push(connectionLines);
    parts.push("");
  }

  parts.push("## Synthesis");
  parts.push("This exploration connects the concepts above through the relationships listed. Each relationship represents a semantic link — such as support, contradiction, analogy, or causation — that binds the ideas together into a coherent knowledge structure.");
  parts.push("");

  return parts.join("\n");
}