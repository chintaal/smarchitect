"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useStudio } from "@/lib/store";
import { useLensResult, useValidation } from "@/lib/hooks";
import { CATEGORY_META } from "@/lib/crg/catalog";
import { ResourceNode, type RFNodeData } from "./resource-node";
import { EmptyCanvas } from "./empty-canvas";

const nodeTypes = { resource: ResourceNode };

// ResourceNode is fixed-width; giving React Flow explicit dimensions makes it
// treat nodes as measured and render them (and their edges) immediately, instead
// of waiting on a ResizeObserver pass that can stall in some dev environments.
const NODE_W = 208;
const NODE_H = 96;

export function Canvas() {
  const graph = useStudio((s) => s.graph);
  const selectedNodeId = useStudio((s) => s.selectedNodeId);
  const selectedEdgeId = useStudio((s) => s.selectedEdgeId);
  const selectNode = useStudio((s) => s.selectNode);
  const selectEdge = useStudio((s) => s.selectEdge);
  const setNodePosition = useStudio((s) => s.setNodePosition);
  const commitPositions = useStudio((s) => s.commitPositions);
  const connect = useStudio((s) => s.connect);
  const removeNode = useStudio((s) => s.removeNode);
  const removeEdge = useStudio((s) => s.removeEdge);
  const addNodeFromService = useStudio((s) => s.addNodeFromService);

  const validation = useValidation();
  const lens = useLensResult();
  const { screenToFlowPosition, fitView } = useReactFlow();

  const errorNodeIds = useMemo(
    () => new Set(validation.issues.filter((i) => i.severity === "error" && i.nodeId).map((i) => i.nodeId!)),
    [validation],
  );
  const warnNodeIds = useMemo(
    () => new Set(validation.issues.filter((i) => i.severity === "warning" && i.nodeId).map((i) => i.nodeId!)),
    [validation],
  );
  const invalidEdgeIds = useMemo(
    () => new Set(validation.issues.filter((i) => i.edgeId).map((i) => i.edgeId!)),
    [validation],
  );

  // Seed React Flow synchronously from the store so nodes exist on the very
  // first render — React Flow's measurement pipeline needs them present at mount.
  const initialNodes = useMemo<Node[]>(
    () =>
      useStudio.getState().graph.nodes.map((n) => ({
        id: n.id,
        type: "resource",
        position: n.position,
        width: NODE_W,
        height: NODE_H,
        data: { node: n } as RFNodeData,
      })),
    [],
  );
  const [rfNodes, setRfNodes, onNodesChangeBase] = useNodesState<Node>(initialNodes);

  // Reconcile store graph → React Flow nodes, preserving React Flow's measured
  // dimensions and selection so edges keep rendering across store updates.
  useEffect(() => {
    setRfNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      return graph.nodes.map((n) => {
        const data: RFNodeData = {
          node: n,
          lensStatus: lens?.nodeStatus[n.id],
          hasError: errorNodeIds.has(n.id),
          hasWarning: warnNodeIds.has(n.id),
        };
        const ex = prevById.get(n.id);
        if (ex) return { ...ex, position: n.position, selected: n.id === selectedNodeId, data };
        return { id: n.id, type: "resource", position: n.position, width: NODE_W, height: NODE_H, selected: n.id === selectedNodeId, data };
      });
    });
  }, [graph, lens, errorNodeIds, warnNodeIds, selectedNodeId, setRfNodes]);

  // Re-fit the view whenever the *set* of nodes changes (load, generate, add/remove).
  const nodeSetKey = graph.nodes.map((n) => n.id).join(",");
  useEffect(() => {
    if (graph.nodes.length === 0) return;
    const t = setTimeout(() => fitView({ padding: 0.25, maxZoom: 1.1, duration: 350 }), 60);
    return () => clearTimeout(t);
  }, [nodeSetKey, fitView, graph.nodes.length]);

  const rfEdges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => {
        const invalid = invalidEdgeIds.has(e.id);
        const stroke =
          e.kind === "data" ? "hsl(var(--success))" : e.kind === "control" ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "smoothstep",
          selected: e.id === selectedEdgeId,
          animated: e.kind === "data",
          label: e.sensitiveData ? "🔒 sensitive" : e.protocol,
          className: invalid ? "edge-invalid" : undefined,
          labelStyle: { fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 500 },
          labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.9 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          style: { stroke: invalid ? "hsl(var(--destructive))" : stroke },
          markerEnd: { type: MarkerType.ArrowClosed, color: invalid ? "hsl(var(--destructive))" : stroke, width: 16, height: 16 },
        };
      }),
    [graph.edges, selectedEdgeId, invalidEdgeIds],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeBase(changes);
      for (const c of changes) if (c.type === "remove") removeNode(c.id);
    },
    [onNodesChangeBase, removeNode],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const c of changes) if (c.type === "remove") removeEdge(c.id);
    },
    [removeEdge],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) connect(c.source, c.target);
    },
    [connect],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const serviceKey = event.dataTransfer.getData("application/smarchitect-service");
      if (!serviceKey) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNodeFromService(serviceKey, { x: position.x - 104, y: position.y - 30 });
    },
    [screenToFlowPosition, addNodeFromService],
  );

  if (graph.nodes.length === 0) {
    return <EmptyCanvas />;
  }

  return (
    <div className="relative h-full w-full" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onNodeDragStop={(_, node) => {
          setNodePosition(node.id, node.position);
          commitPositions();
        }}
        onEdgeClick={(_, edge) => selectEdge(edge.id)}
        onPaneClick={() => {
          selectNode(null);
          selectEdge(null);
        }}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="hsl(var(--border))" />
        <Controls className="!bottom-6 !left-6" showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          className="!bottom-6 !right-6 !h-28 !w-44"
          maskColor="hsl(var(--background) / 0.7)"
          nodeColor={(n) => {
            const data = n.data as { node?: { category?: keyof typeof CATEGORY_META } };
            const cat = data?.node?.category;
            return cat ? CATEGORY_META[cat].from : "hsl(var(--primary))";
          }}
          nodeStrokeWidth={0}
          nodeBorderRadius={4}
        />
      </ReactFlow>
    </div>
  );
}
