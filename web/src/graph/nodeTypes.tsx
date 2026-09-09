import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useState, useEffect } from "react";
import type { Concept, ConceptDetails, ConceptQAMessage } from "@thinking-explorer/shared";
import {
  generateConceptDetails,
  askConceptQuestion,
  type ConceptQAResponseWithModel,
} from "../features/concept-details/concept-details-service.ts";
import { useQAStore } from "../state/qaStore.js";

export interface ConceptNodeData {
  concept: Concept;
  expanding: boolean;
  dimmed: boolean;
  onExpand?: (id: string) => void;
  onSelect?: (id: string) => void;
  [key: string]: unknown;
}

export function ConceptNode({ data, selected }: NodeProps) {
  const d = data as ConceptNodeData;
  const { concept, expanding, dimmed, onExpand, onSelect } = d;
  const [details, setDetails] = useState<ConceptDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(false);
  const qaStore = useQAStore();
  const [qaMessages, setQaMessages] = useState<ConceptQAMessage[]>([]);
  const [qaInput, setQaInput] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  useEffect(() => {
    setQaMessages(qaStore.getHistory(concept.id));
  }, [concept.id, qaStore]);

  const openConceptDetails = async () => {
    setDetailsLoading(true);
    setDetailsError(false);
    try {
      setDetails(await generateConceptDetails(concept));
    } catch {
      setDetailsError(true);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = qaInput.trim();
    if (!q || qaLoading) return;

    const userMsg: ConceptQAMessage = { role: "user", text: q };
    const nextHistory = [...qaMessages, userMsg];
    setQaMessages(nextHistory);
    qaStore.addMessage(concept.id, userMsg);
    setQaInput("");
    setQaLoading(true);
    setQaError(null);

    try {
      const res: ConceptQAResponseWithModel = await askConceptQuestion(
        concept,
        q,
        qaMessages
      );
      const assistantMsg: ConceptQAMessage & { model?: string } = {
        role: "assistant",
        text: res.answer,
        model: res.model,
      };
      setQaMessages((prev) => [...prev, assistantMsg]);
      qaStore.addMessage(concept.id, assistantMsg);
    } catch (err) {
      setQaError(err instanceof Error ? err.message : "Failed to get answer");
    } finally {
      setQaLoading(false);
    }
  };

  return (
    <div
      className={`concept-node ${selected ? "is-selected" : ""} ${dimmed ? "is-dimmed" : ""}`}
      onClick={() => onSelect?.(concept.id)}
    >
      <Handle type="target" position={Position.Top} />
      <div className="concept-node__row">
        <span className="concept-node__dot" />
        <span className="concept-node__label">{concept.label}</span>
        {concept.origin === "llm" || concept.origin === "derived" ? (
          <span className="concept-node__origin">·</span>
        ) : null}
      </div>
      {concept.category ? (
        <span className="concept-node__chip">{concept.category}</span>
      ) : null}
      {concept.summary ? (
        <p className="concept-node__summary">{concept.summary}</p>
      ) : null}
      <div className="concept-node__actions">
        <button
          className="concept-node__expand"
          disabled={expanding}
          onClick={(e) => {
            e.stopPropagation();
            onExpand?.(concept.id);
          }}
        >
          {expanding ? <><span className="concept-node__spinner" /> Getting information…</> : "Expand"}
        </button>
        <button
          className="concept-node__details"
          onClick={(e) => {
            e.stopPropagation();
            openConceptDetails();
          }}
        >
          More details
        </button>
      </div>
      {detailsLoading || details || detailsError ? (
        <div
          className="concept-details-popup nowheel"
          role="dialog"
          aria-label={`More details about ${concept.label}`}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="concept-details-popup__header">
            <div>
              <span className="concept-details-popup__eyebrow">Concept details</span>
              <strong>{concept.label}</strong>
            </div>
            <button
              className="concept-details-popup__close"
              aria-label="Close details"
              onClick={() => {
                setDetails(null);
                setQaError(null);
              }}
            >
              ×
            </button>
          </div>
          {detailsLoading ? (
            <p className="concept-details-popup__muted concept-details-popup__loading">
              <span className="concept-node__spinner" /> Getting information…
            </p>
          ) : detailsError ? (
            <p className="concept-details-popup__error">Unable to generate details.</p>
          ) : details ? (
            <div className="concept-details-popup__body">
              <p><strong>Overview</strong>{details.overview}</p>
              <p><strong>Why it matters</strong>{details.significance}</p>
              <p><strong>Connections</strong>{details.connections}</p>
              <p><strong>Example</strong>{details.example}</p>

              <div className="concept-details-qa">
                <div className="concept-details-qa__title">Ask a follow-up question</div>

                 {qaMessages.length > 0 && (
                  <div className="concept-details-qa__messages">
                    {qaMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`concept-details-qa__bubble concept-details-qa__bubble--${msg.role}`}
                      >
                        <span className="concept-details-qa__role">
                          {msg.role === "user"
                            ? "You"
                            : `AI · ${(msg as ConceptQAMessage & { model?: string }).model ?? "openrouter"}`}
                        </span>
                        <p>{msg.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {qaLoading && (
                  <p className="concept-details-popup__muted concept-details-popup__loading" style={{ margin: "6px 0" }}>
                    <span className="concept-node__spinner" /> Thinking…
                  </p>
                )}

                {qaError && (
                  <p className="concept-details-popup__error" style={{ margin: "6px 0" }}>
                    {qaError}
                  </p>
                )}

                <form onSubmit={handleAskQuestion} className="concept-details-qa__form">
                  <input
                    type="text"
                    value={qaInput}
                    onChange={(e) => setQaInput(e.target.value)}
                    placeholder="Ask something about this concept..."
                    disabled={qaLoading}
                    className="concept-details-qa__input"
                  />
                  <button
                    type="submit"
                    className="primary concept-details-qa__submit"
                    disabled={qaLoading || !qaInput.trim()}
                  >
                    Ask
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export interface BridgeNodeData {
  concept: Concept;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  [key: string]: unknown;
}

export function BridgeNode({ data, selected }: NodeProps) {
  const d = data as BridgeNodeData;
  const { concept, onAccept, onReject } = d;
  return (
    <div
      className={`bridge-node ${selected ? "is-selected" : ""}`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="bridge-node__label">{concept.label}</div>
      {concept.category ? (
        <span className="bridge-node__chip">{concept.category}</span>
      ) : null}
      {concept.summary ? (
        <p className="bridge-node__summary">{concept.summary}</p>
      ) : null}
      <div className="bridge-node__actions">
        <button
          className="bridge-node__accept"
          onClick={(e) => {
            e.stopPropagation();
            onAccept?.(concept.id);
          }}
        >
          Accept
        </button>
        <button
          className="bridge-node__reject"
          onClick={(e) => {
            e.stopPropagation();
            onReject?.(concept.id);
          }}
        >
          Reject
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}