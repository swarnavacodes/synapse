import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HealthResponseSchema,
  type HealthResponse,
  type Concept,
  type CompareResponse,
  type ChallengeResponse,
  type TrailEvent,
  type WebSearchResult,
  type ExportSummary,
} from "@thinking-explorer/shared";
import { Canvas } from "./graph/Canvas.js";
import { useGraphStore } from "./state/graphStore.js";
import { SidePanel } from "./features/sidepanel/SidePanel.js";
import { SessionList } from "./features/sessions/SessionList.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { useSelectionStore } from "./state/selectionStore.js";
import { CommandPalette } from "./features/commandpalette/CommandPalette.js";
import { TrailPanel } from "./features/trail/TrailPanel.js";
import { CompareModal } from "./features/compare/CompareModal.js";
import { ChallengeModal } from "./features/challenge/ChallengeModal.js";
import { FilterPanel } from "./features/filter/FilterPanel.js";
import { SearchPanel, SearchResults } from "./features/search/SearchPanel.js";
import { ExportModal } from "./features/export/ExportModal.js";
import { useFilterStore, persistFilterForSession } from "./state/filterStore.js";

type Status =
  | { kind: "loading" }
  | { kind: "ok"; data: HealthResponse }
  | { kind: "error"; message: string };

const NO_KEY_BANNER_DISMISSED = "synapse:no-key-banner-dismissed";

export function App() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [trailOpen, setTrailOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(NO_KEY_BANNER_DISMISSED) === "1";
    } catch {
      return false;
    }
  });
  const [compare, setCompare] = useState<
    | { a: Concept; b: Concept; result: CompareResponse }
    | null
  >(null);
  const [challenge, setChallenge] = useState<
    | { label: string; result: ChallengeResponse }
    | null
  >(null);
  const [searchResults, setSearchResults] = useState<
    | { results: WebSearchResult[]; query: string; answer: string | null }
    | null
  >(null);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const currentSessionId = useGraphStore((s) => s.currentSessionId);
  const session = useGraphStore((s) => s.session);
  const createSession = useGraphStore((s) => s.createSession);
  const closeSession = useGraphStore((s) => s.closeSession);
  const concepts = useGraphStore((s) => s.concepts);
  const trail = useGraphStore((s) => s.trail);
  const loading = useGraphStore((s) => s.loading);
  const expandNode = useGraphStore((s) => s.expandNode);
  const connectNodes = useGraphStore((s) => s.connectNodes);
  const challengeNode = useGraphStore((s) => s.challengeNode);
  const compareNodes = useGraphStore((s) => s.compareNodes);
  const loadTrail = useGraphStore((s) => s.loadTrail);
  const fetchExportSummary = useGraphStore((s) => s.fetchExportSummary);

  const selectedNodeId = useSelectionStore((s) => s.selectedNodeId);
  const selectNode = useSelectionStore((s) => s.selectNode);
  const focusEnabled = useSelectionStore((s) => s.focusEnabled);
  const toggleFocus = useSelectionStore((s) => s.toggleFocus);

  const closeFilterOnCanvasClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".topbar__filter-toggle") || target.closest(".topbar__filter-badge")) {
      return;
    }
    if (!target.closest(".filter-panel")) {
      setFilterOpen(false);
    }
  }, []);

  useEffect(() => {
    if (filterOpen) document.addEventListener("click", closeFilterOnCanvasClick as unknown as EventListener);
    return () => {
      document.removeEventListener("click", closeFilterOnCanvasClick as unknown as EventListener);
    };
  }, [filterOpen, closeFilterOnCanvasClick]);

  const hiddenCategories = useFilterStore((s) => s.hiddenCategories);
  const hiddenTypes = useFilterStore((s) => s.hiddenTypes);
  const hiddenKinds = useFilterStore((s) => s.hiddenKinds);
  const hydrateFromSession = useFilterStore((s) => s.hydrateFromSession);

  const selectedNode = useMemo(
    () => concepts.find((c) => c.id === selectedNodeId) ?? null,
    [concepts, selectedNodeId]
  );

  useEffect(() => {
    if (!currentSessionId) {
      selectNode(null);
      return;
    }
    const saved = window.localStorage.getItem(`synapse:selected:${currentSessionId}`);
    selectNode(saved);
    hydrateFromSession(currentSessionId);
  }, [currentSessionId, selectNode, hydrateFromSession]);

  useEffect(() => {
    if (!currentSessionId) return;
    const key = `synapse:selected:${currentSessionId}`;
    if (selectedNodeId) window.localStorage.setItem(key, selectedNodeId);
    else window.localStorage.removeItem(key);
  }, [currentSessionId, selectedNodeId]);

  useEffect(() => {
    if (!currentSessionId) return;
    persistFilterForSession(currentSessionId, {
      hiddenCategories,
      hiddenTypes,
      hiddenKinds,
    } as never);
  }, [currentSessionId, hiddenCategories, hiddenTypes, hiddenKinds]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        const parsed = HealthResponseSchema.safeParse(json);
        if (!parsed.success) throw new Error("Invalid health payload");
        if (!cancelled) setStatus({ kind: "ok", data: parsed.data });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: e instanceof Error ? e.message : "Unknown error",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (trailOpen && currentSessionId && trail.length === 0) {
      void loadTrail();
    }
  }, [trailOpen, currentSessionId, trail.length, loadTrail]);

  const handleExpand = useCallback(
    (id: string) => {
      void expandNode({ nodeId: id, depth: 1 });
    },
    [expandNode]
  );

  const handleConnect = useCallback(
    (from: string, to: string) => {
      void connectNodes({ fromNodeId: from, toNodeId: to, maxBridges: 3 });
    },
    [connectNodes]
  );

  const handleChallenge = useCallback(
    async (target: { kind: "concept" | "relationship"; id: string }) => {
      try {
        const result = await challengeNode({ target });
        const label =
          target.kind === "concept"
            ? concepts.find((c) => c.id === target.id)?.label ?? "concept"
            : "relationship";
        setChallenge({ label, result });
      } catch {
        // surfaced via store error
      }
    },
    [challengeNode, concepts]
  );

  const handleCompare = useCallback(
    async (aId: string, bId: string) => {
      try {
        const result = await compareNodes({ aNodeId: aId, bNodeId: bId });
        const a = concepts.find((c) => c.id === aId);
        const b = concepts.find((c) => c.id === bId);
        if (a && b) setCompare({ a, b, result });
      } catch {
        // surfaced via store error
      }
    },
    [compareNodes, concepts]
  );

  const handleExport = useCallback(async () => {
    // If we already have a summary, just show it (don't regenerate)
    if (exportSummary) {
      return;
    }
    setExportLoading(true);
    try {
      const summary = await fetchExportSummary();
      setExportSummary(summary);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExportLoading(false);
    }
  }, [fetchExportSummary, exportSummary]);

  const handleTrailEvent = useCallback(
    (event: TrailEvent) => {
      const id = (event.payload as { nodeId?: string; aNodeId?: string }).nodeId
        ?? (event.payload as { aNodeId?: string }).aNodeId;
      if (typeof id === "string" && concepts.some((c) => c.id === id)) {
        selectNode(id);
      }
    },
    [concepts, selectNode]
  );

  const llmConfigured = status.kind === "ok" ? status.data.llmConfigured : true;
  const showBanner = status.kind === "ok" && !llmConfigured && !bannerDismissed;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Thinking Explorer</h1>
          <div className="topbar__sub">
            {status.kind === "ok" ? (
              <span className="topbar__health">
                <span
                  className={`topbar__health-dot ${loading ? "" : "is-down"}`}
                  style={{ background: loading ? "var(--ok)" : "var(--text-dim)", boxShadow: "none" }}
                />
                {loading ? "Loading" : "Connected"} · v{status.data.version}
              </span>
            ) : status.kind === "error" ? (
              <span className="topbar__health">
                <span className="topbar__health-dot is-down" />
                Backend: {status.message}
              </span>
            ) : (
              <span className="topbar__health">
                <span className="topbar__health-dot is-down" />
                Connecting…
              </span>
            )}
          </div>
        </div>

        <div className="topbar__right">
          {selectedNode ? (
            <span className="topbar__selected">
              <span>Selected</span>
              <strong>{selectedNode.label}</strong>
              <button
                className="topbar__clear"
                onClick={() => selectNode(null)}
                title="Clear selection"
                aria-label="Clear selection"
              >
                ×
              </button>
            </span>
          ) : null}

          <div className="topbar__actions">
            <button
              className="topbar__palette-btn"
              onClick={() => setPaletteOpen(true)}
              title="Open command palette (Ctrl/⌘+K)"
            >
              Commands <kbd>⌘K</kbd>
            </button>
            <button
              className={`topbar__focus-toggle ${focusEnabled ? "is-on" : ""}`}
              onClick={toggleFocus}
              disabled={!selectedNode}
              title={selectedNode ? "Toggle focus on selection" : "Select a node first"}
            >
              Focus {focusEnabled ? "On" : "Off"}
            </button>
            <button
              className={`topbar__trail-toggle ${trailOpen ? "is-on" : ""}`}
              onClick={() => setTrailOpen((v) => !v)}
              disabled={!currentSessionId}
              title="Toggle exploration trail"
            >
              Trail
            </button>
            <div className="topbar__filter-wrap">
              <button
                className={`topbar__filter-toggle ${
                  filterOpen
                    ? "is-on"
                    : hiddenCategories.size + hiddenTypes.size + hiddenKinds.size > 0
                    ? "is-active"
                    : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterOpen((v) => !v);
                }}
                disabled={!currentSessionId}
                title="Filter visible concepts and relationships"
              >
                Filter
                {hiddenCategories.size + hiddenTypes.size + hiddenKinds.size > 0 ? (
                  <span className="topbar__filter-badge">
                    {hiddenCategories.size + hiddenTypes.size + hiddenKinds.size}
                  </span>
                ) : null}
              </button>
              {filterOpen ? <FilterPanel onClose={() => setFilterOpen(false)} /> : null}
            </div>
            {currentSessionId ? (
              <div className="topbar__session-info">
                <span className="topbar__session" title={session?.title ?? "Untitled session"}>
                  {session?.title ? `Session: ${session.title}` : "Editing session"}
                </span>
                <button
                  className="topbar__session-btn"
                  onClick={() => {
                    closeSession();
                    selectNode(null);
                  }}
                  title="End session and return to session selection"
                >
                  End session
                </button>
                <button
                  className="topbar__session-btn"
                  onClick={() => setPanelOpen(!panelOpen)}
                  title="Hide/show side panel"
                >
                  Panel: {panelOpen ? "Open" : "Closed"}
                </button>
                <button
                  className="topbar__session-btn primary"
                  onClick={() => {
                    if (exportSummary) {
                      // Already generated — just reopen/re-show modal
                      // The modal is shown because exportSummary is set
                      return;
                    }
                    void handleExport();
                  }}
                  disabled={exportLoading}
                  title={exportSummary ? "Show generated summary" : "Generate session summary"}
                >
                  {exportLoading ? "Generating..." : exportSummary ? "Show Summary" : "Export Summary"}
                </button>
              </div>
            ) : (
              <div className="topbar__session-info">
                <span className="topbar__session">No session</span>
                <button
                  className="topbar__session-btn primary"
                  onClick={async () => {
                    const title = window.prompt("New session title (optional):");
                    if (title !== null) {
                      await createSession(title.trim() || undefined);
                      selectNode(null);
                    }
                  }}
                  title="Create a new exploration session"
                >
                  + New session
                </button>
                <button
                  className="topbar__session-btn"
                  onClick={() => setPanelOpen(!panelOpen)}
                  title="Hide/show side panel"
                >
                  Panel: {panelOpen ? "Open" : "Closed"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showBanner ? (
        <div className="no-key-banner fade-in" role="status">
          <span className="no-key-banner__icon">⚠</span>
          <span>
            No <code>OPENROUTER_API_KEY</code> is configured on the server.
            Expand, Connect, Challenge, and Compare are disabled.
          </span>
          <button
            className="no-key-banner__close"
            onClick={() => {
              setBannerDismissed(true);
              try {
                window.localStorage.setItem(NO_KEY_BANNER_DISMISSED, "1");
              } catch {
                /* ignore */
              }
            }}
            aria-label="Dismiss"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="workspace" style={{ gridTemplateColumns: panelOpen ? "1fr 320px" : "1fr" }}>
        <ErrorBoundary>
          <Canvas />
        </ErrorBoundary>
        {panelOpen ? (
          <aside className="panel">
            <section className="panel__section">
              <h3>Sessions</h3>
              <SessionList />
            </section>
            {currentSessionId ? (
              <section className="panel__section">
                <h3>Web Search</h3>
                <SearchPanel
                  onResults={(results, q, answer) =>
                    setSearchResults({ results, query: q, answer })
                  }
                />
              </section>
            ) : null}
            <SidePanel />
          </aside>
        ) : null}
      </div>

      {paletteOpen ? (
        <CommandPalette
          concepts={concepts}
          onExpand={handleExpand}
          onConnect={handleConnect}
          onChallenge={handleChallenge}
          onCompare={handleCompare}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}

      {trailOpen ? (
        <TrailPanel
          events={trail}
          onEventClick={handleTrailEvent}
          onClose={() => setTrailOpen(false)}
        />
      ) : null}

      {compare ? (
        <CompareModal
          a={compare.a}
          b={compare.b}
          result={compare.result}
          onClose={() => setCompare(null)}
        />
      ) : null}

      {challenge ? (
        <ChallengeModal
          targetLabel={challenge.label}
          result={challenge.result}
          onClose={() => setChallenge(null)}
        />
      ) : null}

      {searchResults ? (
        <SearchResults
          query={searchResults.query}
          answer={searchResults.answer}
          results={searchResults.results}
          onClose={() => setSearchResults(null)}
        />
      ) : null}

      {exportSummary ? (
        <ExportModal
          summary={exportSummary}
          onClose={() => setExportSummary(null)}
          onRegenerate={() => {
            setExportSummary(null);
            // Clear summary but don't trigger regeneration automatically
            // User can click Export Summary button again to regenerate
          }}
        />
      ) : null}
    </div>
  );
}