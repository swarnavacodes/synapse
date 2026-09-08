import { useCallback, useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type OnNodeDrag,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useGraphStore } from "../state/graphStore.js";
import { useSelectionStore } from "../state/selectionStore.js";
import { useFilterStore } from "../state/filterStore.js";
import { ConceptNode } from "./nodeTypes.js";
import { ExpandMetricsToast } from "../features/expand/ExpandMetricsToast.js";
import { RelationshipEdge } from "./edgeTypes.js";
import { arrangeConcepts, edgesFromRelationships, layoutConcepts } from "./layout.js";

const nodeTypes = { concept: ConceptNode };
const edgeTypes = { relationship: RelationshipEdge };

export function Canvas() {
  const concepts = useGraphStore((s) => s.concepts);
  const relationships = useGraphStore((s) => s.relationships);
  const expandingNodeId = useGraphStore((s) => s.expandingNodeId);
  const expandNode = useGraphStore((s) => s.expandNode);
  const positions = useGraphStore((s) => s.positions);
  const updatePosition = useGraphStore((s) => s.updatePosition);
  const savePositions = useGraphStore((s) => s.savePositions);
  const selectedNodeId = useSelectionStore((s) => s.selectedNodeId);
  const focusEnabled = useSelectionStore((s) => s.focusEnabled);
  const selectNode = useSelectionStore((s) => s.selectNode);
  const hiddenCategories = useFilterStore((s) => s.hiddenCategories);
  const hiddenTypes = useFilterStore((s) => s.hiddenTypes);
  const hiddenKinds = useFilterStore((s) => s.hiddenKinds);

  const handleExpand = useCallback(
    (id: string) => {
      void expandNode({ nodeId: id, depth: 1 });
    },
    [expandNode]
  );

  const handleSelectFromNode = useCallback(
    (id: string) => {
      selectNode(selectedNodeId === id ? null : id);
    },
    [selectedNodeId, selectNode]
  );

  const neighbourSet = useMemo(() => {
    if (!selectedNodeId) return null;
    const set = new Set<string>([selectedNodeId]);
    for (const r of relationships) {
      if (r.sourceId === selectedNodeId) set.add(r.targetId);
      if (r.targetId === selectedNodeId) set.add(r.sourceId);
    }
    return set;
  }, [selectedNodeId, relationships]);

  const { nodes, edges } = useMemo(() => {
    const layout = arrangeConcepts(concepts, relationships);
    const focusDim = focusEnabled && neighbourSet !== null;
    const conceptById = new Map(concepts.map((c) => [c.id, c]));

    const passesConceptFilters = (c: { id: string; category?: string | null }) => {
      const cat = (c.category ?? "").trim() || "Uncategorized";
      if (hiddenCategories.has(cat)) return false;
      if (focusDim && !neighbourSet!.has(c.id)) return false;
      return true;
    };

    const visibleRelationshipEdges = edgesFromRelationships(relationships).filter((e) => {
      const rel = (e.data?.rel) as
        | { type: string; kind: string; sourceId: string; targetId: string }
        | undefined;
      if (rel && hiddenTypes.has(rel.type as never)) return false;
      if (rel && hiddenKinds.has(rel.kind as never)) return false;
      const s = conceptById.get(e.source);
      const t = conceptById.get(e.target);
      if (s && !passesConceptFilters(s)) return false;
      if (t && !passesConceptFilters(t)) return false;
      if (focusDim && (!neighbourSet!.has(e.source) || !neighbourSet!.has(e.target))) return false;
      return true;
    });
    const connectedIds = new Set<string>();
    for (const edge of visibleRelationshipEdges) {
      connectedIds.add(edge.source);
      connectedIds.add(edge.target);
    }

    const ns: Node[] = concepts
      .filter((c) => passesConceptFilters(c) && (connectedIds.has(c.id) || c.origin === "user"))
      .map((c) => ({
        id: c.id,
        type: "concept",
        position: positions[c.id] ?? layout.get(c.id) ?? { x: 0, y: 0 },
        data: {
          concept: c,
          expanding: expandingNodeId === c.id,
          dimmed: false,
          onExpand: handleExpand,
          onSelect: handleSelectFromNode,
        },
      }));
    const es: Edge[] = visibleRelationshipEdges
      .map((e) => ({
        ...e,
        type: "relationship",
        data: { ...e.data, dimmed: false },
      }));
    return { nodes: ns, edges: es };
  }, [
    concepts,
    relationships,
    expandingNodeId,
    positions,
    focusEnabled,
    neighbourSet,
    hiddenCategories,
    hiddenTypes,
    hiddenKinds,
    handleExpand,
    handleSelectFromNode,
  ]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_e, node) => {
      handleSelectFromNode(node.id);
    },
    [handleSelectFromNode]
  );

  const handleNodeDragStop: OnNodeDrag = useCallback((_event, node) => {
    updatePosition(node.id, node.position);
    void savePositions({ ...positions, [node.id]: node.position });
  }, [positions, savePositions, updatePosition]);

  if (concepts.length === 0) {
    return (
      <div className="canvas canvas--empty">
        <p>No concepts yet. Add one from the side panel to start exploring.</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    const filtersActive =
      hiddenCategories.size > 0 || hiddenTypes.size > 0 || hiddenKinds.size > 0;
    return (
      <div className="canvas canvas--empty">
        <p>
          {filtersActive
            ? "All concepts are hidden by the current filter."
            : "No connected concepts yet."}
        </p>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          {filtersActive
            ? <>Open the <strong>Filter</strong> panel in the topbar to bring items back.</>
            : "Add another subject and connect it to start building the graph."}
        </p>
      </div>
    );
  }

  return (
    <div className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        nodesDraggable
        zoomOnScroll
        noWheelClassName="nowheel"
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
        <MiniMap pannable zoomable />
        <Controls />
        <GraphToolbar concepts={concepts} />
      </ReactFlow>
      <ExpandMetricsToast />
    </div>
  );
}

function GraphToolbar({ concepts }: { concepts: ReturnType<typeof useGraphStore.getState>["concepts"] }) {
  const { fitView } = useReactFlow();
  const relationships = useGraphStore((s) => s.relationships);
  const updatePosition = useGraphStore((s) => s.updatePosition);
  const savePositions = useGraphStore((s) => s.savePositions);

  const resetLayout = useCallback(() => {
    const nextPositions: Record<string, { x: number; y: number }> = {};
    for (const node of layoutConcepts(concepts).values()) {
      nextPositions[node.id] = { x: node.x, y: node.y };
      updatePosition(node.id, nextPositions[node.id]);
    }
    void savePositions(nextPositions);
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
  }, [concepts, fitView, savePositions, updatePosition]);

  const arrangeLayout = useCallback(() => {
    const nextPositions: Record<string, { x: number; y: number }> = {};
    for (const node of arrangeConcepts(concepts, relationships).values()) {
      nextPositions[node.id] = { x: node.x, y: node.y };
      updatePosition(node.id, nextPositions[node.id]);
    }
    void savePositions(nextPositions);
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 450 }));
  }, [concepts, relationships, fitView, savePositions, updatePosition]);

  return (
    <div className="graph-toolbar">
      <button title="Fit graph" aria-label="Fit graph" onClick={() => fitView({ padding: 0.2, duration: 300 })}>
        Fit
      </button>
      <button title="Reset layout" aria-label="Reset layout" onClick={resetLayout}>
        Reset
      </button>
      <button title="Arrange by relationships" aria-label="Arrange by relationships" onClick={arrangeLayout}>
        Arrange
      </button>
    </div>
  );
}