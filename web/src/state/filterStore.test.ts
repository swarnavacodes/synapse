import { describe, it, expect, beforeEach } from "vitest";
import { useFilterStore, persistFilterForSession } from "./filterStore.js";

describe("filterStore", () => {
  beforeEach(() => {
    useFilterStore.getState().clearAll();
    window.localStorage.clear();
  });

  it("toggles categories on and off", () => {
    const store = useFilterStore.getState();
    expect(store.hiddenCategories.has("science")).toBe(false);

    store.toggleCategory("science");
    expect(useFilterStore.getState().hiddenCategories.has("science")).toBe(true);

    useFilterStore.getState().toggleCategory("science");
    expect(useFilterStore.getState().hiddenCategories.has("science")).toBe(false);
  });

  it("toggles relationship types", () => {
    useFilterStore.getState().toggleType("causes");
    expect(useFilterStore.getState().hiddenTypes.has("causes")).toBe(true);
    useFilterStore.getState().toggleType("causes");
    expect(useFilterStore.getState().hiddenTypes.has("causes")).toBe(false);
  });

  it("toggles relationship kinds", () => {
    useFilterStore.getState().toggleKind("fact");
    expect(useFilterStore.getState().hiddenKinds.has("fact")).toBe(true);
    useFilterStore.getState().toggleKind("fact");
    expect(useFilterStore.getState().hiddenKinds.has("fact")).toBe(false);
  });

  it("clearAll resets all hidden sets", () => {
    useFilterStore.getState().toggleCategory("cat");
    useFilterStore.getState().toggleType("supports");
    useFilterStore.getState().toggleKind("analogy");

    useFilterStore.getState().clearAll();
    const s = useFilterStore.getState();
    expect(s.hiddenCategories.size).toBe(0);
    expect(s.hiddenTypes.size).toBe(0);
    expect(s.hiddenKinds.size).toBe(0);
  });

  it("persists and hydrates filters for a session", () => {
    useFilterStore.getState().setHiddenCategories(new Set(["math"]));
    useFilterStore.getState().setHiddenTypes(new Set(["contradicts"]));
    useFilterStore.getState().setHiddenKinds(new Set(["interpretation"]));

    persistFilterForSession("session-1", useFilterStore.getState());

    // Reset store
    useFilterStore.getState().clearAll();
    expect(useFilterStore.getState().hiddenTypes.size).toBe(0);

    // Hydrate back
    useFilterStore.getState().hydrateFromSession("session-1");
    const rehydrated = useFilterStore.getState();
    expect(rehydrated.hiddenCategories.has("math")).toBe(true);
    expect(rehydrated.hiddenTypes.has("contradicts")).toBe(true);
    expect(rehydrated.hiddenKinds.has("interpretation")).toBe(true);
  });
});