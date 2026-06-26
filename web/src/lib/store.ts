"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  CloudResourceGraph,
  PatchHistoryEntry,
  ResourceEdge,
  ResourceNode,
} from "./crg/types";
import { makeEdge, makeNode } from "./crg/factory";
import { autoLayout } from "./crg/layout";
import { recomputeCosts } from "./crg/cost";
import { cloneGraph } from "./crg/compliance/shared";
import { getTemplate } from "./crg/templates";

const HISTORY_LIMIT = 60;

interface StudioState {
  projectName: string;
  graph: CloudResourceGraph;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  lensFrameworkId: string | null;
  patchHistory: PatchHistoryEntry[];
  past: CloudResourceGraph[];
  future: CloudResourceGraph[];

  // selection
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;

  // structural mutations (history-tracked)
  addNodeFromService: (serviceKey: string, position: { x: number; y: number }) => void;
  updateNode: (id: string, patch: Partial<ResourceNode>) => void;
  updateNodeSecurity: (id: string, patch: Partial<ResourceNode["security"]>) => void;
  removeNode: (id: string) => void;
  connect: (source: string, target: string) => void;
  updateEdge: (id: string, patch: Partial<ResourceEdge>) => void;
  removeEdge: (id: string) => void;

  // live position (not history-tracked individually)
  setNodePosition: (id: string, position: { x: number; y: number }) => void;
  commitPositions: () => void;

  // graph-level ops
  replaceGraph: (g: CloudResourceGraph, intent: string, summary: string, changeCount?: number) => void;
  runAutoLayout: () => void;
  loadTemplate: (id: string) => void;
  newBlank: () => void;
  setProjectName: (name: string) => void;

  // compliance lens
  setLens: (frameworkId: string | null) => void;

  // history
  undo: () => void;
  redo: () => void;
}

function pushHistory(state: StudioState, next: CloudResourceGraph): Partial<StudioState> {
  const past = [...state.past, cloneGraph(state.graph)].slice(-HISTORY_LIMIT);
  return { graph: recomputeCosts(next), past, future: [] };
}

function record(state: StudioState, intent: string, summary: string, changeCount: number): PatchHistoryEntry[] {
  const entry: PatchHistoryEntry = {
    id: nanoid(8),
    intent,
    summary,
    appliedAt: new Date().toISOString(),
    appliedBy: "you",
    changeCount,
  };
  return [entry, ...state.patchHistory].slice(0, 50);
}

export const useStudio = create<StudioState>((set, get) => ({
  projectName: "Untitled Architecture",
  graph: getTemplate("three-tier")!.build(),
  selectedNodeId: null,
  selectedEdgeId: null,
  lensFrameworkId: null,
  patchHistory: [],
  past: [],
  future: [],

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  addNodeFromService: (serviceKey, position) =>
    set((s) => {
      const node = makeNode(serviceKey, position);
      const next = { ...s.graph, nodes: [...s.graph.nodes, node] };
      return {
        ...pushHistory(s, next),
        selectedNodeId: node.id,
        patchHistory: record(s, "add-node", `Added ${node.name}`, 1),
      };
    }),

  updateNode: (id, patch) =>
    set((s) => {
      const next = {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      };
      return { ...pushHistory(s, next), patchHistory: record(s, "edit-node", `Edited node config`, 1) };
    }),

  updateNodeSecurity: (id, patch) =>
    set((s) => {
      const next = {
        ...s.graph,
        nodes: s.graph.nodes.map((n) =>
          n.id === id ? { ...n, security: { ...n.security, ...patch } } : n,
        ),
      };
      return { ...pushHistory(s, next), patchHistory: record(s, "edit-security", `Updated security`, 1) };
    }),

  removeNode: (id) =>
    set((s) => {
      const node = s.graph.nodes.find((n) => n.id === id);
      const next = {
        nodes: s.graph.nodes.filter((n) => n.id !== id),
        edges: s.graph.edges.filter((e) => e.source !== id && e.target !== id),
      };
      return {
        ...pushHistory(s, next),
        selectedNodeId: null,
        patchHistory: record(s, "remove-node", `Removed ${node?.name ?? "node"}`, 1),
      };
    }),

  connect: (source, target) =>
    set((s) => {
      if (source === target) return s;
      if (s.graph.edges.some((e) => e.source === source && e.target === target)) return s;
      const edge = makeEdge(source, target);
      const next = { ...s.graph, edges: [...s.graph.edges, edge] };
      return { ...pushHistory(s, next), patchHistory: record(s, "connect", `Connected nodes`, 1) };
    }),

  updateEdge: (id, patch) =>
    set((s) => {
      const next = {
        ...s.graph,
        edges: s.graph.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      };
      return { ...pushHistory(s, next), patchHistory: record(s, "edit-edge", `Edited connection`, 1) };
    }),

  removeEdge: (id) =>
    set((s) => {
      const next = { ...s.graph, edges: s.graph.edges.filter((e) => e.id !== id) };
      return { ...pushHistory(s, next), selectedEdgeId: null, patchHistory: record(s, "remove-edge", `Removed connection`, 1) };
    }),

  setNodePosition: (id, position) =>
    set((s) => ({
      graph: { ...s.graph, nodes: s.graph.nodes.map((n) => (n.id === id ? { ...n, position } : n)) },
    })),

  commitPositions: () =>
    set((s) => ({ past: [...s.past, cloneGraph(s.graph)].slice(-HISTORY_LIMIT), future: [] })),

  replaceGraph: (g, intent, summary, changeCount = 1) =>
    set((s) => ({
      ...pushHistory(s, g),
      patchHistory: record(s, intent, summary, changeCount),
    })),

  runAutoLayout: () =>
    set((s) => ({ ...pushHistory(s, autoLayout(s.graph)), patchHistory: record(s, "auto-layout", "Auto-laid out the graph", s.graph.nodes.length) })),

  loadTemplate: (id) =>
    set((s) => {
      const tpl = getTemplate(id);
      if (!tpl) return s;
      return {
        graph: recomputeCosts(tpl.build()),
        projectName: tpl.name,
        past: [],
        future: [],
        selectedNodeId: null,
        selectedEdgeId: null,
        patchHistory: record(s, "load-template", `Loaded template "${tpl.name}"`, 1),
      };
    }),

  newBlank: () =>
    set(() => ({
      graph: { nodes: [], edges: [] },
      projectName: "Untitled Architecture",
      past: [],
      future: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      patchHistory: [],
    })),

  setProjectName: (name) => set({ projectName: name }),

  setLens: (frameworkId) => set((s) => ({ lensFrameworkId: s.lensFrameworkId === frameworkId ? null : frameworkId })),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      return {
        graph: previous,
        past: s.past.slice(0, -1),
        future: [cloneGraph(s.graph), ...s.future].slice(0, HISTORY_LIMIT),
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        graph: next,
        past: [...s.past, cloneGraph(s.graph)].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
      };
    }),
}));
