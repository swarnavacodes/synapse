import { describe, it, expect, beforeEach } from "vitest";
import { useSelectionStore } from "./selectionStore.js";

describe("selectionStore", () => {
  beforeEach(() => {
    useSelectionStore.getState().selectNode(null);
    useSelectionStore.getState().setFocus(false);
  });

  it("selects and unselects a node", () => {
    useSelectionStore.getState().selectNode("node-1");
    expect(useSelectionStore.getState().selectedNodeId).toBe("node-1");

    useSelectionStore.getState().selectNode(null);
    expect(useSelectionStore.getState().selectedNodeId).toBeNull();
  });

  it("toggles focus on and off", () => {
    expect(useSelectionStore.getState().focusEnabled).toBe(false);

    useSelectionStore.getState().toggleFocus();
    expect(useSelectionStore.getState().focusEnabled).toBe(true);

    useSelectionStore.getState().toggleFocus();
    expect(useSelectionStore.getState().focusEnabled).toBe(false);
  });

  it("sets focus explicitly", () => {
    useSelectionStore.getState().setFocus(true);
    expect(useSelectionStore.getState().focusEnabled).toBe(true);
  });
});