"use client";

import * as React from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INVENTORY } from "@/lib/data/mock";
import { PROVIDER_META } from "@/lib/crg/catalog";
import { formatCurrency, cn } from "@/lib/utils";
import { Search, AlertTriangle, TrendingUp, Boxes, ArrowRight, Filter } from "lucide-react";

const DRIFT_META: Record<string, { variant: "success" | "warning" | "destructive" | "muted"; label: string }> = {
  synced: { variant: "muted", label: "Synced" },
  added: { variant: "success", label: "Added (unmanaged)" },
  removed: { variant: "destructive", label: "Removed" },
  changed: { variant: "warning", label: "Changed" },
};

export default function InventoryPage() {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "drift" | "anomaly">("all");

  const rows = INVENTORY.filter((r) => {
    if (filter === "drift" && r.drift === "synced") return false;
    if (filter === "anomaly" && !r.tags.some((t) => t.includes("anomaly") || t.includes("orphan") || t.includes("unmanaged"))) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q) || r.account.toLowerCase().includes(q);
  });

  const driftCount = INVENTORY.filter((r) => r.drift !== "synced").length;
  const anomalyCount = INVENTORY.filter((r) => r.tags.some((t) => t.includes("anomaly") || t.includes("orphan"))).length;
  const totalSpend = INVENTORY.reduce((s, r) => s + r.monthly, 0);

  return (
    <PageShell
      title="Inventory"
      description="Imported resources, drift detection, and multi-account view"
      actions={
        <Button size="sm" variant="outline" asChild>
          <a href="/studio"><Boxes className="size-4" /> Open in Studio</a>
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Resources</span>
            <Boxes className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{INVENTORY.length}</div>
          <div className="text-[11px] text-muted-foreground">across 4 accounts</div>
        </Card>
        <Card className={cn("p-4", driftCount > 0 && "ring-1 ring-warning/30")}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Drift detected</span>
            <AlertTriangle className="size-4 text-warning" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-warning">{driftCount}</div>
          <div className="text-[11px] text-muted-foreground">vs. designed graph</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Cost anomalies</span>
            <TrendingUp className="size-4 text-destructive" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{anomalyCount}</div>
          <div className="text-[11px] text-muted-foreground">forgotten / orphaned</div>
        </Card>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources…"
            className="h-9 w-full rounded-lg border border-input bg-background/40 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card/40 p-1">
          <Filter className="ml-1.5 size-3.5 text-muted-foreground" />
          {(["all", "drift", "anomaly"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                filter === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="ml-auto text-sm text-muted-foreground">
          Tracked spend: <span className="font-semibold text-foreground">{formatCurrency(totalSpend)}/mo</span>
        </div>
      </div>

      <Card className="mt-3 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Resource</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Account / Region</th>
              <th className="px-4 py-2.5 font-medium">Drift</th>
              <th className="px-4 py-2.5 text-right font-medium">Monthly</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-accent/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded text-[9px] font-bold text-white" style={{ background: `hsl(var(--${r.provider}))` }}>
                      {PROVIDER_META[r.provider].short}
                    </span>
                    <span className="font-medium">{r.name}</span>
                  </div>
                  {r.tags.some((t) => t.includes("anomaly") || t.includes("orphan")) && (
                    <span className="mt-1 ml-8 inline-flex items-center gap-1 text-[10px] text-destructive">
                      <TrendingUp className="size-3" /> cost anomaly · forgotten resource
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.type}</td>
                <td className="px-4 py-3">
                  <div className="text-[13px]">{r.account}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{r.region}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={DRIFT_META[r.drift].variant} className="text-[10px]">{DRIFT_META[r.drift].label}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatCurrency(r.monthly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No resources match.</div>}
      </Card>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        Drifted resources render with a badge on the canvas.
        <a href="/studio" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          Review drift in Studio <ArrowRight className="size-3" />
        </a>
      </div>
    </PageShell>
  );
}
