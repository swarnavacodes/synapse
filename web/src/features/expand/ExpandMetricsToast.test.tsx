import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ExpandMetricsToast } from "./ExpandMetricsToast.js";
import { useGraphStore } from "../../state/graphStore.js";

describe("ExpandMetricsToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGraphStore.setState({ expandMetrics: null });
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders nothing when expandMetrics is null", () => {
    const { container } = render(<ExpandMetricsToast />);
    expect(container.firstChild).toBeNull();
  });

  it("renders metrics when present", () => {
    useGraphStore.setState({
      expandMetrics: {
        conceptCount: 4,
        relationshipCount: 5,
        avgStrength: 0.8,
        typeBreakdown: {
          supports: 3,
          contradicts: 0,
          part_of: 2,
          analogous_to: 0,
          causes: 0,
          requires: 0,
          bridges: 0,
          related_to: 0,
        },
      },
    });

    render(<ExpandMetricsToast />);
    expect(screen.getByText("Expand complete")).toBeTruthy();
    expect(screen.getByText("+4")).toBeTruthy();
    expect(screen.getByText("concepts")).toBeTruthy();
    expect(screen.getByText("+5")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
    expect(screen.getByText("Strong")).toBeTruthy();
    expect(screen.getByText("supports")).toBeTruthy();
    expect(screen.getByText("part of")).toBeTruthy();
  });

  it("dismisses on close button click", () => {
    useGraphStore.setState({
      expandMetrics: {
        conceptCount: 1,
        relationshipCount: 1,
        avgStrength: 0.5,
        typeBreakdown: {
          supports: 1,
          contradicts: 0,
          part_of: 0,
          analogous_to: 0,
          causes: 0,
          requires: 0,
          bridges: 0,
          related_to: 0,
        },
      },
    });

    render(<ExpandMetricsToast />);
    const closeBtn = screen.getByLabelText("Dismiss");
    fireEvent.click(closeBtn);
    expect(useGraphStore.getState().expandMetrics).toBeNull();
  });

  it("auto-dismisses after 6 seconds", () => {
    useGraphStore.setState({
      expandMetrics: {
        conceptCount: 1,
        relationshipCount: 1,
        avgStrength: 0.5,
        typeBreakdown: {
          supports: 1,
          contradicts: 0,
          part_of: 0,
          analogous_to: 0,
          causes: 0,
          requires: 0,
          bridges: 0,
          related_to: 0,
        },
      },
    });

    render(<ExpandMetricsToast />);
    expect(useGraphStore.getState().expandMetrics).not.toBeNull();
    vi.advanceTimersByTime(6000);
    expect(useGraphStore.getState().expandMetrics).toBeNull();
  });
});