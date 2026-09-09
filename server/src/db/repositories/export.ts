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

  const sessionLabel = title ? `"${title}"` : "Untitled";
  
  // Opening paragraph
  parts.push(`This exploration session, ${sessionLabel}, represents an intellectual journey through ${conceptCount} interconnected concepts, woven together by ${relationshipCount} semantic relationships. `);
  
  if (categories.length > 0) {
    parts.push(`The exploration spans ${categories.length === 1 ? 'the domain of' : 'multiple domains including'} **${categories.join(", ")}**, `);
  }
  
  if (originCounts.user > 0 && originCounts.llm > 0) {
    parts.push(`combining ${originCounts.user} user-initiated ${originCounts.user === 1 ? 'concept' : 'concepts'} with ${originCounts.llm} AI-generated ${originCounts.llm === 1 ? 'expansion' : 'expansions'}, creating a collaborative knowledge structure. `);
  } else if (originCounts.llm > 0) {
    parts.push(`with ${originCounts.llm} AI-generated concepts forming an extensive knowledge network. `);
  } else if (originCounts.user > 0) {
    parts.push(`built entirely from ${originCounts.user} user-defined ${originCounts.user === 1 ? 'concept' : 'concepts'}. `);
  }

  parts.push("\n\n");
  
  // Concept overview
  parts.push("## Core Concepts\n\n");
  parts.push("The session explores the following key ideas:\n\n");
  
  const conceptsPerLine = Math.min(conceptLabels.length, 10);
  for (let i = 0; i < conceptLabels.length; i += conceptsPerLine) {
    const chunk = conceptLabels.slice(i, i + conceptsPerLine);
    parts.push("- " + chunk.join(", ") + "\n");
  }
  
  parts.push("\n");
  
  // Relationship insights
  if (connectionLines) {
    parts.push("## Knowledge Structure\n\n");
    parts.push(`The ${relationshipCount} relationships form a semantic network where concepts are linked through various logical connections — including support, contradiction, analogy, causation, and compositional relationships. `);
    parts.push("These connections reveal the deeper patterns and dependencies within the conceptual space.\n\n");
    
    const connectionSample = connectionLines.split("\n").slice(0, 8);
    parts.push("**Key relationships include:**\n\n");
    for (const conn of connectionSample) {
      parts.push(`- ${conn}\n`);
    }
    if (relationshipCount > 8) {
      parts.push(`\n...and ${relationshipCount - 8} additional connections.\n`);
    }
    parts.push("\n");
  }

  // Closing synthesis
  parts.push("## Synthesis\n\n");
  parts.push("This exploration demonstrates how complex ideas interconnect and build upon one another. ");
  parts.push("Each concept serves as a node in a larger web of understanding, with relationships mapping the logical, causal, and analogical bridges between them. ");
  
  if (originCounts.llm > 0) {
    parts.push("The AI-assisted expansion has revealed deeper layers and unexpected connections, enriching the conceptual landscape. ");
  }
  
  parts.push("Together, these elements form a coherent intellectual framework that captures both the breadth and depth of the subject matter.");
  
  return parts.join("");
}