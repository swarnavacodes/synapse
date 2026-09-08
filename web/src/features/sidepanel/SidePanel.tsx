import { useMemo, useState } from "react";
import {
  RelationshipTypeSchema,
  RelationshipKindSchema,
  type Concept,
  type Relationship,
} from "@thinking-explorer/shared";
import { useGraphStore } from "../../state/graphStore.js";
import { useSelectionStore } from "../../state/selectionStore.js";
import { useFilterStore } from "../../state/filterStore.js";

const RELATIONSHIP_TYPES = RelationshipTypeSchema.options;
const RELATIONSHIP_KINDS = RelationshipKindSchema.options;

function categoryOf(c: { category?: string | null }): string {
  return (c.category ?? "").trim() || "Uncategorized";
}

export function SidePanel() {
  const currentSessionId = useGraphStore((s) => s.currentSessionId);
  const session = useGraphStore((s) => s.session);
  const concepts = useGraphStore((s) => s.concepts);
  const relationships = useGraphStore((s) => s.relationships);
  const error = useGraphStore((s) => s.error);
  const openSession = useGraphStore((s) => s.openSession);
  const createSession = useGraphStore((s) => s.createSession);
  const closeSession = useGraphStore((s) => s.closeSession);
  const addConcept = useGraphStore((s) => s.addConcept);
  const addRelationship = useGraphStore((s) => s.addRelationship);
  const removeConcept = useGraphStore((s) => s.removeConcept);
  const clearError = useGraphStore((s) => s.clearError);
  const retryExpand = useGraphStore((s) => s.retryExpand);
  const lastExpandRequest = useGraphStore((s) => s.lastExpandRequest);
  const expandingNodeId = useGraphStore((s) => s.expandingNodeId);
  const selectedNodeId = useSelectionStore((s) => s.selectedNodeId);
  const selectNode = useSelectionStore((s) => s.selectNode);
  const hiddenCategories = useFilterStore((s) => s.hiddenCategories);
  const hiddenTypes = useFilterStore((s) => s.hiddenTypes);
  const hiddenKinds = useFilterStore((s) => s.hiddenKinds);

  const visibleConcepts = useMemo(
    () => {
      const categoryVisible = new Set(
        concepts
          .filter((c) => !hiddenCategories.has(categoryOf(c)))
          .map((c) => c.id)
      );
      const connectedIds = new Set<string>();
      for (const relationship of relationships) {
        if (hiddenTypes.has(relationship.type) || hiddenKinds.has(relationship.kind)) continue;
        if (!categoryVisible.has(relationship.sourceId) || !categoryVisible.has(relationship.targetId)) continue;
        connectedIds.add(relationship.sourceId);
        connectedIds.add(relationship.targetId);
      }
      return concepts.filter(
        (c) => categoryVisible.has(c.id) && (connectedIds.has(c.id) || c.origin === "user")
      );
    },
    [concepts, relationships, hiddenCategories, hiddenTypes, hiddenKinds]
  );
  const conceptById = useMemo(
    () => new Map(visibleConcepts.map((c) => [c.id, c])),
    [visibleConcepts]
  );
  const visibleRelationships = useMemo(
    () =>
      relationships.filter((r) => {
        if (hiddenTypes.has(r.type)) return false;
        if (hiddenKinds.has(r.kind)) return false;
        if (!conceptById.has(r.sourceId)) return false;
        if (!conceptById.has(r.targetId)) return false;
        return true;
      }),
    [relationships, hiddenTypes, hiddenKinds, conceptById]
  );
  const [search, setSearch] = useState("");
  const filteredConcepts = useMemo(
    () => {
      const q = search.trim().toLowerCase();
      if (!q) return visibleConcepts;
      return visibleConcepts.filter((c) => c.label.toLowerCase().includes(q));
    },
    [visibleConcepts, search]
  );
  const hiddenCount = concepts.length - visibleConcepts.length;
  const filtersActive =
    hiddenCategories.size > 0 || hiddenTypes.size > 0 || hiddenKinds.size > 0;

  if (!currentSessionId) {
    return <SessionGate onCreate={createSession} error={error} onClearError={clearError} />;
  }

  return (
    <>
      <section className="panel__section">
        <h3>Session</h3>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <strong>{session?.title ?? "Untitled session"}</strong>
          <button
            style={{ fontSize: 11, padding: "3px 8px" }}
            onClick={() => {
              closeSession();
              selectNode(null);
            }}
            title="End current session"
          >
            End session
          </button>
        </div>
      </section>

      <section className="panel__section">
        <h3>Add concept</h3>
        <ConceptForm onSubmit={addConcept} />
      </section>

      <section className="panel__section">
        <h3>Connect</h3>
        <RelationshipForm
          concepts={visibleConcepts}
          onSubmit={addRelationship}
        />
      </section>

      <div className="panel__body">
        {error ? (
          <div className="error">
            {error}{" "}
            {lastExpandRequest && !expandingNodeId ? (
              <button onClick={() => void retryExpand()}>Retry</button>
            ) : null}{" "}
            <button onClick={clearError}>Dismiss</button>
          </div>
        ) : null}

        <section>
          <h3>
            Concepts ({filteredConcepts.length}
            {hiddenCount > 0 ? ` of ${concepts.length}` : ""})
          </h3>
          <div className="field">
            <label>Search concepts</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by label"
            />
          </div>
          {filteredConcepts.length === 0 ? (
            <div className="filter-panel__empty">
              {search.trim()
                ? "No concepts match the search."
                : filtersActive && hiddenCount > 0
                  ? "All concepts are hidden by the current filter."
                  : "No connected concepts yet."}
            </div>
          ) : (
            <ul className="concept-list">
              {filteredConcepts.map((c) => (
                <li key={c.id} className="concept-list__item">
                  <div>
                    <div>{c.label}</div>
                    <small>{c.category || "no category"}</small>
                  </div>
                  <button
                    aria-label={`Delete ${c.label}`}
                    title={`Delete ${c.label}`}
                    onClick={async () => {
                      if (!window.confirm(`Delete "${c.label}" and its relationships?`)) return;
                      try {
                        await removeConcept(c.id);
                        if (selectedNodeId === c.id) selectNode(null);
                      } catch {
                        // The store exposes the API error in the panel.
                      }
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3>
            Relationships ({visibleRelationships.length}
            {relationships.length - visibleRelationships.length > 0
              ? ` of ${relationships.length}`
              : ""})
          </h3>
          {visibleRelationships.length === 0 ? (
            <div className="filter-panel__empty">
              {relationships.length > 0
                ? "All relationships are hidden by the current filter."
                : "No relationships yet."}
            </div>
          ) : (
            <ul className="rel-list">
              {visibleRelationships.map((r) => (
                <li key={r.id} className="concept-list__item">
                  <div>
                    <div>
                      {labelFor(conceptById, r.sourceId)} → {labelFor(conceptById, r.targetId)}
                    </div>
                    <small>
                      {r.type} · {r.kind} · {(r.strength * 100).toFixed(0)}%
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <button onClick={() => void openSession(currentSessionId)}>
            Reload from server
          </button>
        </section>
      </div>
    </>
  );
}

function labelFor(concepts: Map<string, Concept>, id: string): string {
  return concepts.get(id)?.label ?? "—";
}

function SessionGate({
  onCreate,
  error,
  onClearError,
}: {
  onCreate: (title?: string) => Promise<string>;
  error: string | null;
  onClearError: () => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="panel__body">
      <h3>Create a session</h3>
      {error ? (
        <div className="error">
          {error} <button onClick={onClearError}>Dismiss</button>
        </div>
      ) : null}
      <div className="field">
        <label>Title (optional)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My exploration"
        />
      </div>
      <button
        className="primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onCreate(title || undefined);
          } finally {
            setBusy(false);
          }
        }}
      >
        Create session
      </button>
    </div>
  );
}

function ConceptForm({
  onSubmit,
}: {
  onSubmit: (input: { label: string; category?: string; summary?: string }) => Promise<Concept>;
}) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!label.trim()) return;
        setBusy(true);
        try {
          await onSubmit({ label: label.trim(), category: category.trim(), summary: summary.trim() });
          setLabel("");
          setCategory("");
          setSummary("");
        } finally {
          setBusy(false);
        }
      }}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div className="field">
        <label>Label</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Consciousness" />
      </div>
      <div className="field">
        <label>Category</label>
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="philosophy" />
      </div>
      <div className="field">
        <label>Summary</label>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="1–2 sentences" />
      </div>
      <button className="primary" type="submit" disabled={busy || !label.trim()}>
        Add concept
      </button>
    </form>
  );
}

function RelationshipForm({
  concepts,
  onSubmit,
}: {
  concepts: Concept[];
  onSubmit: (input: {
    sourceId: string;
    targetId: string;
    type: Relationship["type"];
    kind: Relationship["kind"];
    strength?: number;
    explanation?: string;
  }) => Promise<Relationship>;
}) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [type, setType] = useState<Relationship["type"]>("related_to");
  const [kind, setKind] = useState<Relationship["kind"]>("interpretation");
  const [strength, setStrength] = useState(0.5);
  const [busy, setBusy] = useState(false);

  const disabled = !sourceId || !targetId || sourceId === targetId;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (disabled) return;
        setBusy(true);
        try {
          await onSubmit({ sourceId, targetId, type, kind, strength });
        } finally {
          setBusy(false);
        }
      }}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div className="row">
        <div className="field">
          <label>From</label>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">—</option>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>To</label>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">—</option>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as Relationship["type"])}>
            {RELATIONSHIP_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Kind</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as Relationship["kind"])}>
            {RELATIONSHIP_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Strength: {strength.toFixed(2)}</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={strength}
          onChange={(e) => setStrength(Number(e.target.value))}
        />
      </div>
      <button className="primary" type="submit" disabled={busy || disabled}>
        Connect
      </button>
    </form>
  );
}