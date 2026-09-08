import { useEffect } from "react";
import type { RelationshipType } from "@thinking-explorer/shared";
import { useGraphStore } from "../../state/graphStore.js";

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

export function ExpandMetricsToast() {
  const metrics = useGraphStore((s) => s.expandMetrics);
  const dismiss = useGraphStore((s) => s.dismissExpandMetrics);

  useEffect(() => {
    if (!metrics) return;
    const t = setTimeout(dismiss, 6000);
    return () => clearTimeout(t);
  }, [metrics, dismiss]);

  if (!metrics) return null;

  const typesPresent = (
    Object.entries(metrics.typeBreakdown) as [RelationshipType, number][]
  ).filter(([, n]) => n > 0);

  const qualityLabel =
    metrics.relationshipCount === 0
      ? "Sparse"
      : metrics.avgStrength > 0.75
      ? "Strong"
      : metrics.avgStrength > 0.45
      ? "Good"
      : "Weak";

  return (
    <div className="expand-metrics-toast fade-in" role="status" aria-live="polite">
      <div className="expand-metrics-toast__header">
        <span className="expand-metrics-toast__title">Expand complete</span>
        <span
          className={`expand-metrics-toast__quality expand-metrics-toast__quality--${qualityLabel.toLowerCase()}`}
        >
          {qualityLabel}
        </span>
        <button
          className="expand-metrics-toast__close"
          onClick={dismiss}
          aria-label="Dismiss"
          title="Dismiss"
        >
          ×
        </button>
      </div>

      <div className="expand-metrics-toast__stats">
        <div className="expand-metrics-toast__stat">
          <span className="expand-metrics-toast__stat-value">+{metrics.conceptCount}</span>
          <span className="expand-metrics-toast__stat-label">concepts</span>
        </div>
        <div className="expand-metrics-toast__divider" />
        <div className="expand-metrics-toast__stat">
          <span className="expand-metrics-toast__stat-value">+{metrics.relationshipCount}</span>
          <span className="expand-metrics-toast__stat-label">links</span>
        </div>
        <div className="expand-metrics-toast__divider" />
        <div className="expand-metrics-toast__stat">
          <span className="expand-metrics-toast__stat-value">
            {(metrics.avgStrength * 100).toFixed(0)}%
          </span>
          <span className="expand-metrics-toast__stat-label">avg strength</span>
        </div>
      </div>

      {typesPresent.length > 0 && (
        <div className="expand-metrics-toast__types">
          {typesPresent.map(([t, n]) => (
            <span
              key={t}
              className="expand-metrics-toast__type-chip"
              style={{ borderColor: TYPE_COLOR[t], color: TYPE_COLOR[t] }}
              title={t}
            >
              <span className="expand-metrics-toast__type-dot" style={{ background: TYPE_COLOR[t] }} />
              {t.replace(/_/g, " ")}
              <span className="expand-metrics-toast__type-count">{n}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
