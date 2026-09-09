import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ExportSummary } from "@thinking-explorer/shared";

interface ExportModalProps {
  summary: ExportSummary;
  onClose: () => void;
  onRegenerate?: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {});
}

function downloadSection(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadAsMarkdown(summary: ExportSummary): void {
  const parts: string[] = [];
  parts.push(`# ${summary.session.title ?? "Untitled Session"}`);
  parts.push("");
  parts.push(summary.narrative);
  parts.push("");
  parts.push("## Concepts");
  for (const c of summary.concepts) {
    const cat = c.category ? ` (${c.category})` : "";
    const origin = c.origin !== "user" ? ` — *${c.origin}*` : "";
    const sum = c.summary ? ` — ${c.summary}` : "";
    parts.push(`- **${c.label}**${cat}${origin}${sum}`);
  }
  parts.push("");
  parts.push("## Relationships");
  for (const r of summary.relationships) {
    const expl = r.explanation ? ` — ${r.explanation}` : "";
    parts.push(`- ${r.sourceLabel} —[${r.type}]→ ${r.targetLabel} (${r.kind}, strength: ${r.strength})${expl}`);
  }
  parts.push("");
  parts.push(`_Exported at ${formatTime(summary.exportedAt)}_`);
  const md = parts.join("\n");
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `session-${summary.session.id.slice(0, 8)}-summary.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportModal({ summary, onClose }: ExportModalProps) {
  const [conceptsExpanded, setConceptsExpanded] = useState(false);
  const [connectionsExpanded, setConnectionsExpanded] = useState(false);
  const [qaExpanded, setQaExpanded] = useState(false);

  const qaPairs = useMemo(() => {
    const pairs: Array<{ question: string; answer: string }> = [];
    for (const c of summary.concepts) {
      if (c.summary) {
        pairs.push({ question: `What is "${c.label}" about?`, answer: c.summary });
      }
    }
    for (const r of summary.relationships) {
      if (r.explanation) {
        pairs.push({
          question: `Why does "${r.sourceLabel}" connect to "${r.targetLabel}"?`,
          answer: r.explanation,
        });
      }
    }
    return pairs;
  }, [summary]);

  const handleExportMarkdown = () => {
    downloadAsMarkdown(summary);
  };

  const handleCopyMarkdown = () => {
    const parts: string[] = [];
    parts.push(`# ${summary.session.title ?? "Untitled Session"}`);
    parts.push("");
    parts.push(summary.narrative);
    parts.push("");
    parts.push("## Concepts");
    for (const c of summary.concepts) {
      const cat = c.category ? ` (${c.category})` : "";
      const origin = c.origin !== "user" ? ` — *${c.origin}*` : "";
      const sum = c.summary ? ` — ${c.summary}` : "";
      parts.push(`- **${c.label}**${cat}${origin}${sum}`);
    }
    parts.push("");
    parts.push("## Relationships");
    for (const r of summary.relationships) {
      const expl = r.explanation ? ` — ${r.explanation}` : "";
      parts.push(`- ${r.sourceLabel} —[${r.type}]→ ${r.targetLabel} (${r.kind}, strength: ${r.strength})${expl}`);
    }
    parts.push("");
    parts.push(`_Exported at ${formatTime(summary.exportedAt)}_`);
    copyToClipboard(parts.join("\n"));
  };

  const handleDownloadConcepts = () => {
    const parts: string[] = [];
    parts.push(`# Concepts — ${summary.session.title ?? "Untitled Session"}`);
    parts.push("");
    for (const c of summary.concepts) {
      const cat = c.category ? ` (${c.category})` : "";
      const origin = c.origin !== "user" ? ` — *${c.origin}*` : "";
      const sum = c.summary ? ` — ${c.summary}` : "";
      parts.push(`- **${c.label}**${cat}${origin}${sum}`);
    }
    downloadSection(`session-${summary.session.id.slice(0, 8)}-concepts.md`, parts.join("\n"));
  };

  const handleDownloadConnections = () => {
    const parts: string[] = [];
    parts.push(`# Connections — ${summary.session.title ?? "Untitled Session"}`);
    parts.push("");
    for (const r of summary.relationships) {
      const expl = r.explanation ? ` — ${r.explanation}` : "";
      parts.push(`- ${r.sourceLabel} —[${r.type}]→ ${r.targetLabel} (${r.kind}, strength: ${r.strength})${expl}`);
    }
    downloadSection(`session-${summary.session.id.slice(0, 8)}-connections.md`, parts.join("\n"));
  };

  const handleDownloadQA = () => {
    const parts: string[] = [];
    parts.push(`# Q&A Synthesis — ${summary.session.title ?? "Untitled Session"}`);
    parts.push("");
    for (const qa of qaPairs) {
      parts.push(`**Q: ${qa.question}**`);
      parts.push("");
      parts.push(`A: ${qa.answer}`);
      parts.push("");
    }
    downloadSection(`session-${summary.session.id.slice(0, 8)}-qa.md`, parts.join("\n"));
  };

  return (
    <div className="compare-modal-overlay" onClick={onClose}>
      <div className="compare-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: "80vh", overflow: "auto" }}>
        <div className="compare-modal__header">
          <span className="compare-modal__title">Session Summary</span>
          <button className="compare-modal__close" onClick={onClose}>×</button>
        </div>

        <div className="compare-modal__summary">
          {summary.narrative ? (
            <ReactMarkdown>{summary.narrative}</ReactMarkdown>
          ) : (
            <div style={{ color: "var(--text-dim)", fontStyle: "italic" }}>
              No narrative summary available for this session.
            </div>
          )}
        </div>

        <div className="panel__section">
          <h3>Overview</h3>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            {summary.conceptCount} concepts · {summary.relationshipCount} relationships ·{" "}
            {qaPairs.length} Q&A pairs synthesized
          </div>
        </div>

        <div className="panel__section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0, cursor: "pointer" }} onClick={() => setConceptsExpanded(!conceptsExpanded)}>
              {conceptsExpanded ? "▼" : "▶"} Concepts ({summary.conceptCount})
            </h3>
            <button
              style={{ fontSize: 11, padding: "3px 8px" }}
              onClick={handleDownloadConcepts}
              title="Download concepts as markdown"
            >
              ↓ Download
            </button>
          </div>
          {conceptsExpanded && (
            <ul className="concept-list">
              {summary.concepts.map((c: { id: string; label: string; category?: string; origin: string; summary?: string }) => (
                <li key={c.id} className="concept-list__item">
                  <div>
                    <div>{c.label}</div>
                    <small>{c.category || "no category"} · {c.origin}</small>
                    {c.summary && <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{c.summary}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel__section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0, cursor: "pointer" }} onClick={() => setConnectionsExpanded(!connectionsExpanded)}>
              {connectionsExpanded ? "▼" : "▶"} Connections ({summary.relationshipCount})
            </h3>
            <button
              style={{ fontSize: 11, padding: "3px 8px" }}
              onClick={handleDownloadConnections}
              title="Download connections as markdown"
            >
              ↓ Download
            </button>
          </div>
          {connectionsExpanded && (
            <ul className="rel-list">
              {summary.relationships.map((r: { id: string; sourceLabel: string; targetLabel: string; type: string; kind: string; strength: number; explanation?: string }) => (
                <li key={r.id} className="concept-list__item">
                  <div>
                    <div>
                      {r.sourceLabel} → {r.targetLabel}
                    </div>
                    <small>
                      {r.type} · {r.kind} · {(r.strength * 100).toFixed(0)}%
                      {r.explanation && ` — ${r.explanation}`}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {qaPairs.length > 0 && (
          <div className="panel__section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, cursor: "pointer" }} onClick={() => setQaExpanded(!qaExpanded)}>
                {qaExpanded ? "▼" : "▶"} Q&A Synthesis ({qaPairs.length})
              </h3>
              <button
                style={{ fontSize: 11, padding: "3px 8px" }}
                onClick={handleDownloadQA}
                title="Download Q&A as markdown"
              >
                ↓ Download
              </button>
            </div>
            {qaExpanded && qaPairs.map((qa, i) => (
              <div key={i} style={{ marginBottom: 12, fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>Q: {qa.question}</div>
                <div style={{ color: "var(--text-dim)" }}>A: {qa.answer}</div>
              </div>
            ))}
          </div>
        )}

        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="primary" onClick={handleExportMarkdown}>
            Download .md
          </button>
          <button onClick={handleCopyMarkdown}>Copy to Clipboard</button>
          {onRegenerate && (
            <button onClick={onRegenerate} title="Generate a new summary">
              Regenerate
            </button>
          )}
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}