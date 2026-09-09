import { useState } from "react";
import type { WebSearchResult } from "@thinking-explorer/shared";
import { useGraphStore } from "../../state/graphStore.js";

interface SearchPanelProps {
  onResults: (results: WebSearchResult[], query: string, answer: string | null) => void;
}

export function SearchPanel({ onResults }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webSearch = useGraphStore((s) => s.webSearch);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);
    try {
      const result = await webSearch(q, 5);
      onResults(result.results, result.query, result.answer);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-panel">
      <form onSubmit={handleSubmit} className="search-panel__form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the web for topics..."
          disabled={loading}
          className="search-panel__input"
        />
        <button
          type="submit"
          className="primary search-panel__submit"
          disabled={loading || !query.trim()}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>
      {error && (
        <p className="search-panel__error">{error}</p>
      )}
    </div>
  );
}

interface SearchResultsProps {
  query: string;
  answer: string | null;
  results: WebSearchResult[];
  onClose: () => void;
}

export function SearchResults({ query, answer, results, onClose }: SearchResultsProps) {
  return (
    <div className="search-results">
      <div className="search-results__header">
        <span className="search-results__title">Web Search</span>
        <span className="search-results__query">"{query}"</span>
        <button
          className="search-results__close"
          onClick={onClose}
          title="Close results"
        >
          ×
        </button>
      </div>
      {answer && (
        <div className="search-results__answer">
          <span className="search-results__answer-label">AI Summary</span>
          <p>{answer}</p>
        </div>
      )}
      <div className="search-results__list">
        {results.map((r, i) => (
          <a
            key={i}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="search-results__item"
          >
            <span className="search-results__item-title">{r.title}</span>
            <span className="search-results__item-url">{new URL(r.url).hostname}</span>
            <span className="search-results__item-snippet">{r.content}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
