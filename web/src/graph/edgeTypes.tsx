import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import type { Relationship, RelationshipKind, RelationshipType } from "@thinking-explorer/shared";

interface RelEdgeData {
  rel: Relationship;
  dimmed?: boolean;
  [key: string]: unknown;
}

const TYPE_COLOR: Record<RelationshipType, string> = {
  supports: "#22c55e",
  contradicts: "#ef4444",
  part_of: "#3b82f6",
  analogous_to: "#a855f7",
  causes: "#f97316",
  requires: "#0ea5e9",
  bridges: "#eab308",
  related_to: "#94a3b8",
};

const KIND_DASH: Record<RelationshipKind, string | undefined> = {
  fact: undefined,
  interpretation: "6 4",
  analogy: "2 4",
};

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps) {
  const { rel, dimmed } = (data ?? {}) as RelEdgeData;
  const stroke = TYPE_COLOR[rel.type] ?? "#94a3b8";
  const dashArray = KIND_DASH[rel.kind];
  const baseOpacity = 0.3 + 0.7 * rel.strength;
  const opacity = dimmed ? 0.05 : selected ? 1 : baseOpacity;
  const baseWidth = 1 + 2 * rel.strength;
  const width = selected ? baseWidth + 1 : baseWidth;

  const edgePath = (sx: number, sy: number, tx: number, ty: number) => {
    const dx = tx - sx;
    const dy = ty - sy;
    const dr = Math.hypot(dx, dy) * 0.6;
    return `M${sx},${sy} A${dr},${dr} 0 0,1 ${tx},${ty}`;
  };

  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const showLabel = selected && !dimmed;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath(sourceX, sourceY, targetX, targetY)}
        style={{
          stroke,
          strokeWidth: width,
          opacity,
          strokeDasharray: dashArray,
          transition: "opacity 200ms ease",
        }}
      />
      {showLabel ? (
        <EdgeLabelRenderer>
          <div
            className="rel-edge__label"
            style={{
              transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)`,
              borderColor: stroke,
              color: stroke,
            }}
          >
            {rel.type} · {rel.kind}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}