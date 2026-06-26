import type { CloudResourceGraph, HaMode, ResourceNode, ServiceCategory } from "./types";
import { getService } from "./catalog";

const HA_FACTOR: Record<HaMode, number> = {
  single: 1,
  "multi-az": 1.6,
  "multi-region": 2.4,
  global: 3.0,
};

/** Recompute a node's monthly cost from its catalog baseline + configuration. */
export function computeNodeMonthly(node: ResourceNode): { monthly: number; drivers: string[] } {
  const svc = getService(node.serviceType);
  const base = svc?.baseCost ?? node.costHint.monthly ?? 0;
  const drivers: string[] = [];

  let monthly = base;
  drivers.push(`${svc?.label ?? node.name} baseline ${money(base)}`);

  const ha = HA_FACTOR[node.haMode];
  if (ha !== 1) {
    monthly *= ha;
    drivers.push(`${node.haMode} HA ×${ha}`);
  }

  if (node.category === "compute") {
    const units =
      node.scaling.mode === "auto"
        ? Math.max(1, (node.scaling.min + node.scaling.max) / 2)
        : Math.max(1, node.scaling.min);
    if (units !== 1) {
      monthly *= units;
      drivers.push(`${node.scaling.mode === "auto" ? "avg" : ""} ${round(units)} units`);
    }
  }

  return { monthly: Math.round(monthly), drivers };
}

/** Returns a new graph with every node's costHint recomputed. */
export function recomputeCosts(graph: CloudResourceGraph): CloudResourceGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const { monthly, drivers } = computeNodeMonthly(n);
      return { ...n, costHint: { ...n.costHint, monthly, drivers } };
    }),
  };
}

export interface CostSummary {
  total: number;
  low: number;
  high: number;
  byCategory: { category: ServiceCategory; total: number }[];
  byProvider: { provider: string; total: number }[];
  topDrivers: { name: string; monthly: number }[];
}

export function summarizeCost(graph: CloudResourceGraph): CostSummary {
  let total = 0;
  const byCategory = new Map<ServiceCategory, number>();
  const byProvider = new Map<string, number>();

  for (const n of graph.nodes) {
    const m = n.costHint.monthly;
    total += m;
    byCategory.set(n.category, (byCategory.get(n.category) ?? 0) + m);
    byProvider.set(n.provider, (byProvider.get(n.provider) ?? 0) + m);
  }

  const topDrivers = [...graph.nodes]
    .sort((a, b) => b.costHint.monthly - a.costHint.monthly)
    .slice(0, 5)
    .map((n) => ({ name: n.name, monthly: n.costHint.monthly }));

  return {
    total: Math.round(total),
    low: Math.round(total * 0.82),
    high: Math.round(total * 1.25),
    byCategory: [...byCategory.entries()].map(([category, t]) => ({ category, total: Math.round(t) })).sort((a, b) => b.total - a.total),
    byProvider: [...byProvider.entries()].map(([provider, t]) => ({ provider, total: Math.round(t) })).sort((a, b) => b.total - a.total),
    topDrivers,
  };
}

export interface ProviderComparison {
  provider: "aws" | "azure" | "gcp" | "private";
  label: string;
  monthly: number;
  delta: number; // vs aws
  opsBurden: "low" | "medium" | "high";
  lockIn: "low" | "medium" | "high";
  note: string;
}

/**
 * AWS-vs-Azure-vs-GCP-vs-private comparison (plan §6.5). We index the graph's
 * total against each provider's relative pricing + qualitative trade-offs.
 */
export function compareProviders(graph: CloudResourceGraph): ProviderComparison[] {
  const base = summarizeCost(graph).total;
  const aws = base;
  const rows: ProviderComparison[] = [
    { provider: "aws", label: "AWS", monthly: Math.round(aws), delta: 0, opsBurden: "medium", lockIn: "high", note: "Broadest service catalog; deepest ecosystem." },
    { provider: "azure", label: "Azure", monthly: Math.round(aws * 0.97), delta: 0, opsBurden: "medium", lockIn: "high", note: "Strong enterprise + hybrid (AD, on-prem) integration." },
    { provider: "gcp", label: "GCP", monthly: Math.round(aws * 0.92), delta: 0, opsBurden: "low", lockIn: "medium", note: "Best price/perf on data + Kubernetes (Autopilot)." },
    { provider: "private", label: "Private / On-prem", monthly: Math.round(aws * 0.58), delta: 0, opsBurden: "high", lockIn: "low", note: "Lowest unit cost, highest operational burden; no managed services." },
  ];
  for (const r of rows) r.delta = Math.round(r.monthly - aws);
  return rows;
}

function money(n: number) {
  return `$${Math.round(n)}`;
}
function round(n: number) {
  return Math.round(n * 10) / 10;
}
