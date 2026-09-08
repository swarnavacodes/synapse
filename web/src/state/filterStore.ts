import { create } from "zustand";
import {
  RelationshipTypeSchema,
  RelationshipKindSchema,
  type RelationshipType,
  type RelationshipKind,
} from "@thinking-explorer/shared";

const ALL_TYPES: RelationshipType[] = RelationshipTypeSchema.options;
const ALL_KINDS: RelationshipKind[] = RelationshipKindSchema.options;

export interface FilterState {
  hiddenCategories: Set<string>;
  hiddenTypes: Set<RelationshipType>;
  hiddenKinds: Set<RelationshipKind>;
  setHiddenCategories: (s: Set<string>) => void;
  setHiddenTypes: (s: Set<RelationshipType>) => void;
  setHiddenKinds: (s: Set<RelationshipKind>) => void;
  toggleCategory: (cat: string) => void;
  toggleType: (t: RelationshipType) => void;
  toggleKind: (k: RelationshipKind) => void;
  clearAll: () => void;
  hydrateFromSession: (sessionId: string) => void;
}

function loadSet<T extends string>(key: string, valid?: T[]): Set<T> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    if (!valid) {
      return new Set(parsed.filter((v): v is T => typeof v === "string"));
    }
    const validSet = new Set(valid);
    return new Set(parsed.filter((v): v is T => typeof v === "string" && validSet.has(v as T)));
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

export const useFilterStore = create<FilterState>((set, get) => ({
  hiddenCategories: new Set(),
  hiddenTypes: new Set(),
  hiddenKinds: new Set(),
  setHiddenCategories(s) {
    set({ hiddenCategories: s });
  },
  setHiddenTypes(s) {
    set({ hiddenTypes: s });
  },
  setHiddenKinds(s) {
    set({ hiddenKinds: s });
  },
  toggleCategory(cat) {
    const next = new Set(get().hiddenCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    set({ hiddenCategories: next });
  },
  toggleType(t) {
    const next = new Set(get().hiddenTypes);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    set({ hiddenTypes: next });
  },
  toggleKind(k) {
    const next = new Set(get().hiddenKinds);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    set({ hiddenKinds: next });
  },
  clearAll() {
    set({
      hiddenCategories: new Set(),
      hiddenTypes: new Set(),
      hiddenKinds: new Set(),
    });
  },
  hydrateFromSession(sessionId) {
    set({
      hiddenCategories: loadSet(`synapse:filter:cat:${sessionId}`),
      hiddenTypes: loadSet(`synapse:filter:type:${sessionId}`, ALL_TYPES),
      hiddenKinds: loadSet(`synapse:filter:kind:${sessionId}`, ALL_KINDS),
    });
  },
}));

export function persistFilterForSession(sessionId: string, state: FilterState) {
  saveSet(`synapse:filter:cat:${sessionId}`, state.hiddenCategories);
  saveSet(`synapse:filter:type:${sessionId}`, state.hiddenTypes as Set<string>);
  saveSet(`synapse:filter:kind:${sessionId}`, state.hiddenKinds as Set<string>);
}
