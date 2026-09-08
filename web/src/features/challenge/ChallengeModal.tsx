import type { ChallengeResponse } from "@thinking-explorer/shared";

interface ChallengeModalProps {
  targetLabel: string;
  result: ChallengeResponse;
  onClose: () => void;
}

const SEVERITY_COLOR: Record<string, string> = {
  minor: "#94a3b8",
  moderate: "#f59e0b",
  significant: "#ef4444",
};

export function ChallengeModal({ targetLabel, result, onClose }: ChallengeModalProps) {
  return (
    <div className="compare-modal-overlay" onClick={onClose}>
      <div
        className="compare-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 560 }}
      >
        <div className="compare-modal__header">
          <span className="compare-modal__title">Critiques of “{targetLabel}”</span>
          <button className="compare-modal__close" onClick={onClose}>×</button>
        </div>
        <div
          className="compare-modal__axes"
          style={{ gridTemplateColumns: "1fr" }}
        >
          {result.critiques.map((c, i) => (
            <div
              key={i}
              className="challenge-modal__critique"
            >
              <div className="challenge-modal__critique-header">
                <span
                  className="challenge-modal__severity-dot"
                  style={{ background: SEVERITY_COLOR[c.severity] ?? "#94a3b8" }}
                />
                <span className="challenge-modal__aspect">{c.aspect}</span>
                <span className="challenge-modal__severity">{c.severity}</span>
              </div>
              <div className="challenge-modal__text">{c.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
