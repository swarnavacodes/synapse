import { create } from "zustand";

interface SelectionState {
  selectedNodeId: string | null;
  focusEnabled: boolean;
  selectNode: (id: string | null) => void;
  toggleFocus: () => void;
  setFocus: (on: boolean) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedNodeId: null,
  focusEnabled: false,
  selectNode(id) {
    set({ selectedNodeId: id });
  },
  toggleFocus() {
    set((s) => ({ focusEnabled: !s.focusEnabled }));
  },
  setFocus(on) {
    set({ focusEnabled: on });
  },
}));