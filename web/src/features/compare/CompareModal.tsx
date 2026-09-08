import type { CompareResponse, Concept } from "@thinking-explorer/shared";

interface CompareModalProps {
  a: Concept;
  b: Concept;
  result: CompareResponse;
  onClose: () => void;
}

export function CompareModal({ a, b, result, onClose }: CompareModalProps) {
  return (
    <div className="compare-modal-overlay" onClick={onClose}>
      <div className="compare-modal" onClick={(e) => e.stopPropagation()}>
        <div className="compare-modal__header">
          <span className="compare-modal__title">Compare</span>
          <button className="compare-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="compare-modal__concepts">
          <div className="compare-modal__concept">
            <div className="compare-modal__concept-name">{a.label}</div>
            {a.category && <span className="compare-modal__concept-chip">{a.category}</span>}
          </div>
          <div className="compare-modal__concept">
            <div className="compare-modal__concept-name">{b.label}</div>
            {b.category && <span className="compare-modal__concept-chip">{b.category}</span>}
          </div>
        </div>
        <div className="compare-modal__axes">
          {result.axes.map((ax, i) => (
            <div key={i} className="compare-modal__axis">
              <div className="compare-modal__axis-name">{ax.axis}</div>
              <div className="compare-modal__axis-value">{ax.aValue}</div>
              <div className="compare-modal__axis-value">{ax.bValue}</div>
            </div>
          ))}
        </div>
        <div className="compare-modal__summary">{result.summary}</div>
      </div>
    </div>
  );
}
