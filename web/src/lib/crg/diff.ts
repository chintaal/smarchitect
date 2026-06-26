import type { CloudResourceGraph, ResourceNode } from "./types";

export interface NodeChange {
  node: ResourceNode;
  fields: { field: string; before: string; after: string }[];
}

export interface GraphDiff {
  added: ResourceNode[];
  removed: ResourceNode[];
  changed: NodeChange[];
  edgesAdded: number;
  edgesRemoved: number;
  costDelta: number;
}

/** Visual before/after between two CRG versions (plan §6.1). */
export function diffGraphs(before: CloudResourceGraph, after: CloudResourceGraph): GraphDiff {
  const beforeById = new Map(before.nodes.map((n) => [n.id, n]));
  const afterById = new Map(after.nodes.map((n) => [n.id, n]));

  const added = after.nodes.filter((n) => !beforeById.has(n.id));
  const removed = before.nodes.filter((n) => !afterById.has(n.id));

  const changed: NodeChange[] = [];
  for (const a of after.nodes) {
    const b = beforeById.get(a.id);
    if (!b) continue;
    const fields: NodeChange["fields"] = [];
    const compare = (field: string, bv: unknown, av: unknown) => {
      if (String(bv) !== String(av)) fields.push({ field, before: String(bv), after: String(av) });
    };
    compare("name", b.name, a.name);
    compare("region", b.region, a.region);
    compare("haMode", b.haMode, a.haMode);
    compare("publicAccess", b.security.publicAccess, a.security.publicAccess);
    compare("encryptionAtRest", b.security.encryptionAtRest, a.security.encryptionAtRest);
    compare("encryptionInTransit", b.security.encryptionInTransit, a.security.encryptionInTransit);
    compare("authRequired", b.security.authRequired, a.security.authRequired);
    compare("mtls", b.security.mtls, a.security.mtls);
    compare("monthly", b.costHint.monthly, a.costHint.monthly);
    if (fields.length) changed.push({ node: a, fields });
  }

  const beforeEdges = new Set(before.edges.map((e) => `${e.source}->${e.target}`));
  const afterEdges = new Set(after.edges.map((e) => `${e.source}->${e.target}`));
  const edgesAdded = [...afterEdges].filter((e) => !beforeEdges.has(e)).length;
  const edgesRemoved = [...beforeEdges].filter((e) => !afterEdges.has(e)).length;

  const costBefore = before.nodes.reduce((s, n) => s + n.costHint.monthly, 0);
  const costAfter = after.nodes.reduce((s, n) => s + n.costHint.monthly, 0);

  return { added, removed, changed, edgesAdded, edgesRemoved, costDelta: Math.round(costAfter - costBefore) };
}
