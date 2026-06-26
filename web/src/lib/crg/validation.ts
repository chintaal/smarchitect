import type { CloudResourceGraph, ResourceNode } from "./types";
import { getService } from "./catalog";

export type IssueSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  nodeId?: string;
  edgeId?: string;
  /** Suggested fix the user (or AI) can apply. */
  fix?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  ok: boolean;
}

/**
 * Live graph validation — runs on every mutation. Surfaces invalid edges,
 * missing required configuration, and orphan nodes (plan §6.1).
 */
export function validateGraph(graph: CloudResourceGraph): ValidationResult {
  const issues: ValidationIssue[] = [];
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const degree = new Map<string, number>();
  const seenEdges = new Set<string>();

  for (const n of graph.nodes) degree.set(n.id, 0);

  for (const e of graph.edges) {
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);

    // Dangling edge (target/source removed)
    if (!src || !tgt) {
      issues.push({
        id: `edge-dangling-${e.id}`,
        severity: "error",
        title: "Dangling connection",
        detail: "An edge references a node that no longer exists.",
        edgeId: e.id,
        fix: "Remove the orphaned edge.",
      });
      continue;
    }

    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);

    // Self loop
    if (e.source === e.target) {
      issues.push({
        id: `edge-self-${e.id}`,
        severity: "error",
        title: "Self-referencing edge",
        detail: `"${src.name}" connects to itself.`,
        edgeId: e.id,
        fix: "Delete this edge.",
      });
    }

    // Duplicate edge
    const sig = `${e.source}->${e.target}`;
    if (seenEdges.has(sig)) {
      issues.push({
        id: `edge-dup-${e.id}`,
        severity: "warning",
        title: "Duplicate connection",
        detail: `There is more than one edge from "${src.name}" to "${tgt.name}".`,
        edgeId: e.id,
        fix: "Merge or remove the duplicate edge.",
      });
    }
    seenEdges.add(sig);

    // Edges carrying sensitive data must encrypt in transit
    if (e.sensitiveData && !tgt.security.encryptionInTransit && !src.security.encryptionInTransit) {
      issues.push({
        id: `edge-sensitive-${e.id}`,
        severity: "warning",
        title: "Sensitive data over unencrypted link",
        detail: `The connection to "${tgt.name}" is flagged sensitive but neither endpoint enforces encryption in transit.`,
        edgeId: e.id,
        fix: "Enable encryption in transit on the target service.",
      });
    }

    // Direction sanity: a data/storage node should not originate a network call to ingress/edge
    const tgtSvc = getService(tgt.serviceType);
    if (tgtSvc && (tgtSvc.tier === "edge" || tgtSvc.tier === "ingress") && e.kind === "network") {
      const srcSvc = getService(src.serviceType);
      if (srcSvc && (srcSvc.category === "data" || srcSvc.category === "storage")) {
        issues.push({
          id: `edge-direction-${e.id}`,
          severity: "warning",
          title: "Unusual traffic direction",
          detail: `"${src.name}" (data tier) points at "${tgt.name}" (edge/ingress). Traffic usually flows the other way.`,
          edgeId: e.id,
          fix: "Reverse the edge direction.",
        });
      }
    }
  }

  // Orphan nodes
  for (const n of graph.nodes) {
    if ((degree.get(n.id) ?? 0) === 0 && graph.nodes.length > 1) {
      issues.push({
        id: `node-orphan-${n.id}`,
        severity: "warning",
        title: "Orphan node",
        detail: `"${n.name}" is not connected to anything.`,
        nodeId: n.id,
        fix: "Connect it to the graph or remove it.",
      });
    }
    issues.push(...nodeConfigIssues(n));
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  return { issues, errorCount, warningCount, infoCount, ok: errorCount === 0 };
}

function nodeConfigIssues(n: ResourceNode): ValidationIssue[] {
  const out: ValidationIssue[] = [];

  // Databases / storage must encrypt at rest
  if ((n.category === "data" || n.category === "storage") && !n.security.encryptionAtRest) {
    out.push({
      id: `cfg-enc-rest-${n.id}`,
      severity: "warning",
      title: "Missing encryption at rest",
      detail: `"${n.name}" stores data but encryption at rest is off.`,
      nodeId: n.id,
      fix: "Enable encryption at rest.",
    });
  }

  // Data tier should not be publicly reachable
  if ((n.category === "data" || n.category === "storage") && n.security.publicAccess) {
    out.push({
      id: `cfg-public-data-${n.id}`,
      severity: "error",
      title: "Publicly exposed data store",
      detail: `"${n.name}" is reachable from the public internet.`,
      nodeId: n.id,
      fix: "Disable public access and move it to a private subnet.",
    });
  }

  // Single-AZ databases are a SPOF
  if (n.category === "data" && n.haMode === "single") {
    out.push({
      id: `cfg-spof-${n.id}`,
      severity: "info",
      title: "Single point of failure",
      detail: `"${n.name}" runs in a single AZ with no failover.`,
      nodeId: n.id,
      fix: "Set HA mode to multi-AZ.",
    });
  }

  // Auto-scaling sanity
  if (n.scaling.mode === "auto" && n.scaling.max < n.scaling.min) {
    out.push({
      id: `cfg-scale-${n.id}`,
      severity: "error",
      title: "Invalid scaling range",
      detail: `"${n.name}" has max replicas (${n.scaling.max}) below min (${n.scaling.min}).`,
      nodeId: n.id,
      fix: "Set max ≥ min.",
    });
  }

  return out;
}
