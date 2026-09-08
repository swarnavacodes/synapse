import type { TrailEvent } from "@thinking-explorer/shared";

interface TrailPanelProps {
  events: TrailEvent[];
  onEventClick: (event: TrailEvent) => void;
  onClose: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TrailPanel({ events, onEventClick, onClose }: TrailPanelProps) {
  return (
    <div className="trail-panel">
      <div className="panel__section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3>Exploration Trail</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", padding: "4px 8px" }}>×</button>
        </div>
      </div>
      <div className="panel__body">
        {events.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
            No exploration events yet.
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="trail-panel__event"
              onClick={() => onEventClick(event)}
            >
              <div className="trail-panel__event-header">
                <span className="trail-panel__event-type">{event.type}</span>
                <span className="trail-panel__event-time">{formatTime(event.createdAt)}</span>
              </div>
              <div className="trail-panel__event-summary">{event.resultSummary}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
