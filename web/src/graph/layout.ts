import type { Concept, Relationship } from "@thinking-explorer/shared";

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
}

const RADIUS = 240;
const CENTER_X = 400;
const CENTER_Y = 300;

export function layoutConcepts(concepts: Concept[]): Map<string, LayoutNode> {
  const out = new Map<string, LayoutNode>();
  if (concepts.length === 0) return out;
  if (concepts.length === 1) {
    out.set(concepts[0].id, { id: concepts[0].id, x: CENTER_X, y: CENTER_Y });
    return out;
  }
  const step = (2 * Math.PI) / concepts.length;
  concepts.forEach((c, i) => {
    const angle = i * step - Math.PI / 2;
    out.set(c.id, {
      id: c.id,
      x: CENTER_X + RADIUS * Math.cos(angle),
      y: CENTER_Y + RADIUS * Math.sin(angle),
    });
  });
  return out;
}

export function arrangeConcepts(
  concepts: Concept[],
  relationships: Relationship[]
): Map<string, LayoutNode> {
  const out = new Map<string, LayoutNode>();
  if (concepts.length === 0) return out;

  const neighbors = new Map<string, Set<string>>();
  for (const concept of concepts) neighbors.set(concept.id, new Set());
  for (const relationship of relationships) {
    neighbors.get(relationship.sourceId)?.add(relationship.targetId);
    neighbors.get(relationship.targetId)?.add(relationship.sourceId);
  }

  const remaining = new Set(concepts.map((concept) => concept.id));
  const componentOffsets = new Map<string, number>();
  let componentIndex = 0;
  while (remaining.size > 0) {
    const start = [...remaining].sort(
      (a, b) => (neighbors.get(b)?.size ?? 0) - (neighbors.get(a)?.size ?? 0)
    )[0];
    const levels = new Map<string, number>([[start, 0]]);
    const queue = [start];
    remaining.delete(start);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of neighbors.get(current) ?? []) {
        if (!remaining.has(neighbor)) continue;
        remaining.delete(neighbor);
        levels.set(neighbor, (levels.get(current) ?? 0) + 1);
        queue.push(neighbor);
      }
    }

    const rows = new Map<number, string[]>();
    for (const [id, level] of levels) {
      const row = rows.get(level) ?? [];
      row.push(id);
      rows.set(level, row);
    }
    const componentWidth = Math.max(...[...rows.values()].map((row) => row.length), 1);
    const offset = componentIndex * Math.max(520, componentWidth * 220);
    componentOffsets.set(start, offset);
    for (const [level, ids] of rows) {
      ids.sort((a, b) => (neighbors.get(b)?.size ?? 0) - (neighbors.get(a)?.size ?? 0));
      const rowWidth = (ids.length - 1) * 220;
      ids.forEach((id, index) => {
        out.set(id, {
          id,
          x: offset + 400 - rowWidth / 2 + index * 220,
          y: 220 + level * 190,
        });
      });
    }
    componentIndex++;
  }
  return out;
}

export function edgesFromRelationships(
  rels: Relationship[]
): { id: string; source: string; target: string; data: { rel: Relationship } }[] {
  return rels.map((r) => ({
    id: r.id,
    source: r.sourceId,
    target: r.targetId,
    data: { rel: r },
  }));
}