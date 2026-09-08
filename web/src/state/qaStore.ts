import { create } from "zustand";
import type { ConceptQAMessage } from "@thinking-explorer/shared";

interface QAMessage extends ConceptQAMessage {
  model?: string;
}

interface QAState {
  historyByConcept: Record<string, QAMessage[]>;
  getHistory: (conceptId: string) => QAMessage[];
  addMessage: (conceptId: string, message: QAMessage) => void;
  clearHistory: (conceptId: string) => void;
  clearAll: () => void;
}

export const useQAStore = create<QAState>((set, get) => ({
  historyByConcept: {},
  getHistory(conceptId) {
    return get().historyByConcept[conceptId] ?? [];
  },
  addMessage(conceptId, message) {
    const existing = get().historyByConcept[conceptId] ?? [];
    set((state) => ({
      historyByConcept: {
        ...state.historyByConcept,
        [conceptId]: [...existing, message],
      },
    }));
  },
  clearHistory(conceptId) {
    set((state) => {
      const { [conceptId]: _, ...rest } = state.historyByConcept;
      return { historyByConcept: rest };
    });
  },
  clearAll() {
    set({ historyByConcept: {} });
  },
}));