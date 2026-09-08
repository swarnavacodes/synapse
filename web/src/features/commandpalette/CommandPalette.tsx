import { useState, useEffect, useCallback, useRef } from "react";
import type { Concept } from "@thinking-explorer/shared";

interface CommandPaletteProps {
  concepts: Concept[];
  onExpand: (nodeId: string) => void;
  onConnect: (fromId: string, toId: string) => void;
  onChallenge: (target: { kind: "concept"; id: string }) => void;
  onCompare: (aId: string, bId: string) => void;
  onClose: () => void;
}

type Mode = "expand" | "connect" | "challenge" | "compare";

export function CommandPalette({
  concepts,
  onExpand,
  onConnect,
  onChallenge,
  onCompare,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("expand");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = concepts.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedId((prev) => {
          const idx = filtered.findIndex((c) => c.id === prev);
          return filtered[Math.min(idx + 1, filtered.length - 1)]?.id ?? prev;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedId((prev) => {
          const idx = filtered.findIndex((c) => c.id === prev);
          return filtered[Math.max(idx - 1, 0)]?.id ?? prev;
        });
      } else if (e.key === "Enter" && selectedId) {
        e.preventDefault();
        if (mode === "expand") {
          onExpand(selectedId);
          onClose();
        } else if (mode === "connect") {
          if (!connectFrom) {
            setConnectFrom(selectedId);
          } else {
            onConnect(connectFrom, selectedId);
            onClose();
          }
        } else if (mode === "challenge") {
          onChallenge({ kind: "concept", id: selectedId });
          onClose();
        } else if (mode === "compare") {
          if (!connectFrom) {
            setConnectFrom(selectedId);
          } else {
            onCompare(connectFrom, selectedId);
            onClose();
          }
        }
      }
    },
    [filtered, selectedId, mode, connectFrom, onExpand, onConnect, onChallenge, onCompare, onClose]
  );

  useEffect(() => {
    inputRef.current?.focus();
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const modeLabel =
    mode === "expand"
      ? "Expand concept"
      : mode === "connect"
      ? connectFrom
        ? `Select target for "${concepts.find((c) => c.id === connectFrom)?.label}"...`
        : "Select first concept..."
      : mode === "challenge"
      ? "Challenge concept"
      : connectFrom
      ? `Select second concept for compare...`
      : "Select first concept...";

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette__header">
          <div className="command-palette__modes">
            {(["expand", "connect", "challenge", "compare"] as Mode[]).map((m) => (
              <button
                key={m}
                className={`command-palette__mode ${mode === m ? "is-active" : ""}`}
                onClick={() => {
                  setMode(m);
                  setConnectFrom(null);
                  setSelectedId(null);
                }}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <input
          ref={inputRef}
          className="command-palette__input"
          placeholder={`Search concepts to ${mode}...`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
        />
        <div className="command-palette__hint">{modeLabel}</div>
        <div className="command-palette__list">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`command-palette__item ${selectedId === c.id ? "is-selected" : ""}`}
              onClick={() => setSelectedId(c.id)}
              onDoubleClick={() => {
                if (mode === "expand") {
                  onExpand(c.id);
                  onClose();
                } else if (mode === "connect") {
                  if (!connectFrom) {
                    setConnectFrom(c.id);
                  } else {
                    onConnect(connectFrom, c.id);
                    onClose();
                  }
                } else if (mode === "challenge") {
                  onChallenge({ kind: "concept", id: c.id });
                  onClose();
                } else if (mode === "compare") {
                  if (!connectFrom) {
                    setConnectFrom(c.id);
                  } else {
                    onCompare(connectFrom, c.id);
                    onClose();
                  }
                }
              }}
            >
              <span className="command-palette__item-label">{c.label}</span>
              {c.category && (
                <span className="command-palette__item-chip">{c.category}</span>
              )}
              {connectFrom === c.id && (
                <span className="command-palette__item-badge">From</span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="command-palette__empty">No concepts found</div>
          )}
        </div>
      </div>
    </div>
  );
}
