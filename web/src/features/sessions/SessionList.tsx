import { useEffect, useState } from "react";
import { useGraphStore } from "../../state/graphStore.js";
import { useSelectionStore } from "../../state/selectionStore.js";

export function SessionList() {
  const sessions = useGraphStore((s) => s.sessions);
  const currentSessionId = useGraphStore((s) => s.currentSessionId);
  const openSession = useGraphStore((s) => s.openSession);
  const createSession = useGraphStore((s) => s.createSession);
  const closeSession = useGraphStore((s) => s.closeSession);
  const removeSession = useGraphStore((s) => s.removeSession);
  const refreshSessions = useGraphStore((s) => s.refreshSessions);
  const selectNode = useSelectionStore((s) => s.selectNode);
  const loading = useGraphStore((s) => s.loading);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creatingBusy, setCreatingBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void refreshSessions().then(() => {
      const state = useGraphStore.getState();
      const savedId = window.localStorage.getItem("synapse:last-session");
      if (
        !cancelled &&
        !state.currentSessionId &&
        savedId &&
        state.sessions.some((session) => session.id === savedId)
      ) {
        void state.openSession(savedId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshSessions]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBusy(true);
    try {
      await createSession(newTitle.trim() || undefined);
      setNewTitle("");
      setIsCreating(false);
      selectNode(null);
    } finally {
      setCreatingBusy(false);
    }
  };

  const handleEndSession = () => {
    closeSession();
    selectNode(null);
  };

  return (
    <div className="session-list-wrapper">
      <div className="session-list__toolbar">
        {isCreating ? (
          <form onSubmit={handleCreate} className="session-list__create-form">
            <input
              autoFocus
              type="text"
              placeholder="Session title (optional)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={creatingBusy}
            />
            <div className="row" style={{ marginTop: 4 }}>
              <button className="primary" type="submit" disabled={creatingBusy}>
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewTitle("");
                }}
                disabled={creatingBusy}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="session-list__header-actions">
            <button
              className="primary"
              style={{ fontSize: 12, padding: "4px 8px" }}
              onClick={() => setIsCreating(true)}
              disabled={loading}
              title="Create a new exploration session"
            >
              + New session
            </button>
            {currentSessionId ? (
              <button
                style={{ fontSize: 12, padding: "4px 8px" }}
                onClick={handleEndSession}
                disabled={loading}
                title="End current session and clear canvas"
              >
                End session
              </button>
            ) : null}
          </div>
        )}
      </div>

      {sessions.length === 0 ? (
        <small style={{ marginTop: 8, display: "block" }}>No sessions yet.</small>
      ) : (
        <ul className="session-list" style={{ marginTop: 8 }}>
          {sessions.map((s) => (
            <li key={s.id} className="session-list__row">
              <button
                className={`session-list__item ${
                  s.id === currentSessionId ? "is-active" : ""
                }`}
                disabled={loading || deletingId !== null}
                onClick={() => void openSession(s.id)}
              >
                <div>{s.title ?? "Untitled session"}</div>
                <small>
                  {new Date(s.updatedAt).toLocaleString()}
                </small>
              </button>
              <button
                className="session-list__delete"
                aria-label={`Delete ${s.title ?? "Untitled session"}`}
                title={`Delete ${s.title ?? "Untitled session"}`}
                disabled={loading || deletingId !== null}
                onClick={async () => {
                  if (!window.confirm(`Delete "${s.title ?? "Untitled session"}"? This removes all its topics and relationships.`)) return;
                  setDeletingId(s.id);
                  try {
                    await removeSession(s.id);
                    if (s.id === currentSessionId) selectNode(null);
                  } finally {
                    setDeletingId(null);
                  }
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}