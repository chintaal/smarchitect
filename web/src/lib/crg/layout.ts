import type { CloudResourceGraph, Tier } from "./types";

const TIER_COLUMN: Record<Tier, number> = {
  edge: 0,
  ingress: 1,
  compute: 2,
  integration: 3,
  data: 4,
  security: 5,
  observability: 6,
};

const COL_WIDTH = 300;
const ROW_HEIGHT = 132;
const X0 = 80;
const Y0 = 80;

/**
 * Tier-based auto-layout (plan §6.1): columns left→right by architectural tier,
 * nodes stacked vertically within each tier and vertically centered.
 */
export function autoLayout(graph: CloudResourceGraph): CloudResourceGraph {
  const byColumn = new Map<number, string[]>();

  for (const n of graph.nodes) {
    const col = TIER_COLUMN[n.tier] ?? 2;
    (byColumn.get(col) ?? byColumn.set(col, []).get(col)!).push(n.id);
  }

  const maxRows = Math.max(1, ...[...byColumn.values()].map((c) => c.length));
  const totalHeight = maxRows * ROW_HEIGHT;

  const positions = new Map<string, { x: number; y: number }>();
  for (const [col, ids] of byColumn) {
    const colHeight = ids.length * ROW_HEIGHT;
    const offset = (totalHeight - colHeight) / 2;
    ids.forEach((id, i) => {
      positions.set(id, {
        x: X0 + col * COL_WIDTH,
        y: Y0 + offset + i * ROW_HEIGHT,
      });
    });
  }

  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({
      ...n,
      position: positions.get(n.id) ?? n.position,
    })),
  };
}
