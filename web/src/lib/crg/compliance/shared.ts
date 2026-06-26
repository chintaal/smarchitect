import type { CloudResourceGraph, ResourceNode } from "../types";

export type ControlStatus = "pass" | "fail" | "partial" | "n/a";

export interface ControlEvaluation {
  controlId: string;
  status: ControlStatus;
  affectedNodeIds: string[];
  passNodeIds: string[];
  evidence: string;
}

export interface Control {
  id: string;
  ref: string;
  title: string;
  description: string;
  remediation: string;
  evaluate: (g: CloudResourceGraph) => ControlEvaluation;
  remediate?: (g: CloudResourceGraph) => CloudResourceGraph;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  short: string;
  authority: string;
  catalog: string;
  description: string;
  accent: "primary" | "success" | "warning" | "destructive";
  controls: Control[];
}

export type NodeComplianceStatus = "pass" | "fail" | "partial" | "untested";

export interface FrameworkResult {
  framework: ComplianceFramework;
  score: number;
  controls: ControlEvaluation[];
  nodeStatus: Record<string, NodeComplianceStatus>;
  passCount: number;
  failCount: number;
  partialCount: number;
}

export function cloneGraph(g: CloudResourceGraph): CloudResourceGraph {
  return {
    nodes: g.nodes.map((n) => ({
      ...n,
      security: { ...n.security },
      scaling: { ...n.scaling },
      costHint: { ...n.costHint },
      position: { ...n.position },
      complianceTags: [...n.complianceTags],
      metadata: { ...n.metadata },
    })),
    edges: g.edges.map((e) => ({ ...e })),
  };
}

/** Generic pass/fail evaluation over a subject set with a single predicate. */
export function evalSimple(
  controlId: string,
  subjects: ResourceNode[],
  predicate: (n: ResourceNode) => boolean,
  evidencePass: string,
  evidenceFailSuffix: string,
): ControlEvaluation {
  if (subjects.length === 0) {
    return { controlId, status: "n/a", affectedNodeIds: [], passNodeIds: [], evidence: "No applicable resources." };
  }
  const affected = subjects.filter((n) => !predicate(n));
  const passing = subjects.filter(predicate);
  return {
    controlId,
    status: affected.length === 0 ? "pass" : passing.length === 0 ? "fail" : "partial",
    affectedNodeIds: affected.map((n) => n.id),
    passNodeIds: passing.map((n) => n.id),
    evidence: affected.length === 0 ? evidencePass : `${affected.length} ${evidenceFailSuffix}`,
  };
}

export function evaluateFramework(
  framework: ComplianceFramework,
  graph: CloudResourceGraph,
): FrameworkResult {
  const controls = framework.controls.map((c) => c.evaluate(graph));

  const nodeStatus: Record<string, NodeComplianceStatus> = {};
  for (const n of graph.nodes) nodeStatus[n.id] = "untested";

  for (const ev of controls) {
    for (const id of ev.passNodeIds) if (nodeStatus[id] === "untested") nodeStatus[id] = "pass";
    for (const id of ev.affectedNodeIds) nodeStatus[id] = "fail";
  }

  const applicable = controls.filter((c) => c.status !== "n/a");
  const passCount = controls.filter((c) => c.status === "pass").length;
  const failCount = controls.filter((c) => c.status === "fail").length;
  const partialCount = controls.filter((c) => c.status === "partial").length;

  const earned = applicable.reduce(
    (sum, c) => sum + (c.status === "pass" ? 1 : c.status === "partial" ? 0.5 : 0),
    0,
  );
  const score = applicable.length === 0 ? 100 : Math.round((earned / applicable.length) * 100);

  return { framework, score, controls, nodeStatus, passCount, failCount, partialCount };
}

export function remediateFramework(
  framework: ComplianceFramework,
  graph: CloudResourceGraph,
): CloudResourceGraph {
  let g = cloneGraph(graph);
  for (const c of framework.controls) {
    const ev = c.evaluate(g);
    if ((ev.status === "fail" || ev.status === "partial") && c.remediate) g = c.remediate(g);
  }
  return g;
}

export function remediateControl(
  framework: ComplianceFramework,
  controlId: string,
  graph: CloudResourceGraph,
): CloudResourceGraph {
  const control = framework.controls.find((c) => c.id === controlId);
  if (!control?.remediate) return graph;
  return control.remediate(cloneGraph(graph));
}
