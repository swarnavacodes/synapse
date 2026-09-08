import { useEffect, useMemo, useRef } from "react";
import {
  RelationshipTypeSchema,
  RelationshipKindSchema,
  RelationshipStyleSchema,
  type RelationshipType,
  type RelationshipKind,
  type RelationshipStyle,
} from "@thinking-explorer/shared";
import { useFilterStore } from "../../state/filterStore.js";
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

const KIND_DASH: Record<RelationshipKind, string> = {
  fact: "solid",
  interpretation: "dashed",
  analogy: "dotted",
};

const STYLE_LABEL: Record<RelationshipStyle, string> = {
  curve: "Curved",
  straight: "Straight",
  step: "Step",
};

interface FilterPanelProps {
  onClose: () => void;
}

export function FilterPanel({ onClose }: FilterPanelProps) {
  const concepts = useGraphStore((s) => s.concepts);
  const relationships = useGraphStore((s) => s.relationships);
  const hiddenCategories = useFilterStore((s) => s.hiddenCategories);
  const hiddenTypes = useFilterStore((s) => s.hiddenTypes);
  const hiddenKinds = useFilterStore((s) => s.hiddenKinds);
  const hiddenStyles = useFilterStore((s) => s.hiddenStyles);
  const toggleCategory = useFilterStore((s) => s.toggleCategory);
  const toggleType = useFilterStore((s) => s.toggleType);
  const toggleKind = useFilterStore((s) => s.toggleKind);
  const toggleStyle = useFilterStore((s) => s.toggleStyle);
  const clearAll = useFilterStore((s) => s.clearAll);

  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const categoriesInUse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of concepts) {
      const key = (c.category ?? "").trim() || "Uncategorized";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [concepts]);

  const typesInUse = useMemo(() => {
    const counts = new Map<RelationshipType, number>();
    for (const r of relationships) {
      counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    }
    return RelationshipTypeSchema.options
      .map((t) => [t, counts.get(t) ?? 0] as const)
      .filter(([, n]) => n > 0);
  }, [relationships]);

  const kindsInUse = useMemo(() => {
    const counts = new Map<RelationshipKind, number>();
    for (const r of relationships) {
      counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    }
    return RelationshipKindSchema.options
      .map((k) => [k, counts.get(k) ?? 0] as const)
      .filter(([, n]) => n > 0);
  }, [relationships]);

  const stylesInUse = useMemo(() => {
    const counts = new Map<RelationshipStyle, number>();
    for (const r of relationships) {
      counts.set(r.style ?? "curve", (counts.get(r.style ?? "curve") ?? 0) + 1);
    }
    return RelationshipStyleSchema.options
      .map((s) => [s, counts.get(s) ?? 0] as const)
      .filter(([, n]) => n > 0);
  }, [relationships]);

  const activeCount =
    hiddenCategories.size + hiddenTypes.size + hiddenKinds.size + hiddenStyles.size;

  return (
    <div ref={panelRef} className="filter-panel" role="dialog" aria-label="Filters">
      <div className="filter-panel__header">
        <span className="filter-panel__title">Filters</span>
        {activeCount > 0 ? (
          <button
            className="filter-panel__clear"
            onClick={clearAll}
            title="Clear all filters"
          >
            Clear ({activeCount})
          </button>
        ) : null}
      </div>

      <div className="filter-panel__section">
        <div className="filter-panel__section-header">
          <span>Categories</span>
          <span className="filter-panel__count">
            {categoriesInUse.length - hiddenCategories.size}/{categoriesInUse.length}
          </span>
        </div>
        {categoriesInUse.length === 0 ? (
          <div className="filter-panel__empty">No categories yet</div>
        ) : (
          <div className="filter-panel__chips">
            {categoriesInUse.map(([cat, count]) => {
              const hidden = hiddenCategories.has(cat);
              return (
                <button
                  key={cat}
                  className={`filter-chip ${hidden ? "is-off" : ""}`}
                  onClick={() => toggleCategory(cat)}
                  title={hidden ? "Show" : "Hide"}
                >
                  <span className="filter-chip__label">{cat}</span>
                  <span className="filter-chip__count">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="filter-panel__section">
        <div className="filter-panel__section-header">
          <span>Relationship type</span>
          <span className="filter-panel__count">
            {typesInUse.length - hiddenTypes.size}/{typesInUse.length}
          </span>
        </div>
        {typesInUse.length === 0 ? (
          <div className="filter-panel__empty">No relationships yet</div>
        ) : (
          <div className="filter-panel__chips">
            {typesInUse.map(([t, count]) => {
              const hidden = hiddenTypes.has(t);
              return (
                <button
                  key={t}
                  className={`filter-chip filter-chip--type ${hidden ? "is-off" : ""}`}
                  style={
                    hidden
                      ? undefined
                      : { borderColor: TYPE_COLOR[t], color: TYPE_COLOR[t] }
                  }
                  onClick={() => toggleType(t)}
                  title={hidden ? "Show" : "Hide"}
                >
                  <span
                    className="filter-chip__swatch"
                    style={{ background: TYPE_COLOR[t] }}
                  />
                  <span className="filter-chip__label">{t.replace(/_/g, " ")}</span>
                  <span className="filter-chip__count">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="filter-panel__section">
        <div className="filter-panel__section-header">
          <span>Relationship kind</span>
          <span className="filter-panel__count">
            {kindsInUse.length - hiddenKinds.size}/{kindsInUse.length}
          </span>
        </div>
        {kindsInUse.length === 0 ? (
          <div className="filter-panel__empty">No relationships yet</div>
        ) : (
          <div className="filter-panel__chips">
            {kindsInUse.map(([k, count]) => {
              const hidden = hiddenKinds.has(k);
              return (
                <button
                  key={k}
                  className={`filter-chip ${hidden ? "is-off" : ""}`}
                  onClick={() => toggleKind(k)}
                  title={hidden ? "Show" : "Hide"}
                >
                  <span
                    className={`filter-chip__line filter-chip__line--${KIND_DASH[k]}`}
                  />
                  <span className="filter-chip__label">{k}</span>
                  <span className="filter-chip__count">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="filter-panel__section">
        <div className="filter-panel__section-header">
          <span>Relationship style</span>
          <span className="filter-panel__count">
            {stylesInUse.length - hiddenStyles.size}/{stylesInUse.length}
          </span>
        </div>
        {stylesInUse.length === 0 ? (
          <div className="filter-panel__empty">No relationships yet</div>
        ) : (
          <div className="filter-panel__chips">
            {stylesInUse.map(([s, count]) => {
              const hidden = hiddenStyles.has(s);
              return (
                <button
                  key={s}
                  className={`filter-chip ${hidden ? "is-off" : ""}`}
                  onClick={() => toggleStyle(s)}
                  title={hidden ? "Show" : "Hide"}
                >
                  <span
                    className={`filter-chip__line filter-chip__line--${s === "curve" ? "dashed" : "solid"}`}
                  />
                  <span className="filter-chip__label">{STYLE_LABEL[s]}</span>
                  <span className="filter-chip__count">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
