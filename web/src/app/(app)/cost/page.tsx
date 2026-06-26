"use client";

import * as React from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCostSummary, useProviderComparison } from "@/lib/hooks";
import { CATEGORY_META } from "@/lib/crg/catalog";
import { LLM_SPEND_30D, LLM_SPEND_BY_TASK } from "@/lib/data/mock";
import { formatCurrency, cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Cpu, Minus } from "lucide-react";

export default function CostPage() {
  const cost = useCostSummary();
  const comparison = useProviderComparison();
  const maxCat = Math.max(1, ...cost.byCategory.map((c) => c.total));
  const totalLlm = LLM_SPEND_30D.reduce((s, d) => s + d.amount, 0);

  return (
    <PageShell title="Cost" description="Estimates, multi-cloud comparison, what-if, and LLM spend">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <div className="text-xs text-muted-foreground">Current architecture · monthly</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">{formatCurrency(cost.total)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Confidence band {formatCurrency(cost.low)} – {formatCurrency(cost.high)}
          </div>
          <div className="mt-4 space-y-2">
            {cost.byCategory.map((c) => (
              <div key={c.category}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{CATEGORY_META[c.category].label}</span>
                  <span className="font-medium">{formatCurrency(c.total)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${(c.total / maxCat) * 100}%`, background: CATEGORY_META[c.category].from }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">AWS vs Azure vs GCP vs Private</h2>
            <span className="text-[11px] text-muted-foreground">same graph, repriced per provider</span>
          </div>
          <div className="space-y-2">
            {comparison.map((row) => {
              const max = Math.max(...comparison.map((r) => r.monthly));
              return (
                <div key={row.provider} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm font-medium">{row.label}</div>
                  <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted/50">
                    <div
                      className={cn("flex h-full items-center justify-end rounded-md px-2 text-[11px] font-medium text-white transition-all", row.delta <= 0 ? "bg-success/80" : "bg-primary/70")}
                      style={{ width: `${(row.monthly / max) * 100}%` }}
                    >
                      {formatCurrency(row.monthly)}
                    </div>
                  </div>
                  <div className="flex w-16 shrink-0 items-center gap-1 text-[11px]">
                    {row.delta === 0 ? (
                      <Minus className="size-3 text-muted-foreground" />
                    ) : row.delta < 0 ? (
                      <TrendingDown className="size-3 text-success" />
                    ) : (
                      <TrendingUp className="size-3 text-warning" />
                    )}
                    <span className={cn(row.delta < 0 ? "text-success" : row.delta > 0 ? "text-warning" : "text-muted-foreground")}>
                      {row.delta === 0 ? "base" : `${row.delta > 0 ? "+" : ""}${formatCurrency(row.delta, { compact: true })}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            {comparison.map((row) => (
              <div key={row.provider} className="rounded-lg border border-border bg-card/40 p-2.5">
                <div className="font-medium">{row.label}</div>
                <div className="mt-1 flex gap-1">
                  <Badge variant={row.opsBurden === "low" ? "success" : row.opsBurden === "medium" ? "warning" : "destructive"} className="text-[9px]">
                    ops: {row.opsBurden}
                  </Badge>
                  <Badge variant={row.lockIn === "low" ? "success" : row.lockIn === "medium" ? "warning" : "destructive"} className="text-[9px]">
                    lock-in: {row.lockIn}
                  </Badge>
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{row.note}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Cpu className="size-4 text-primary" /> LLM spend (30 days)
            </h2>
            <span className="text-sm font-semibold">{formatCurrency(totalLlm)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Aggregated from LiteLLM callbacks · your own AI usage cost</p>
          <Sparkbars data={LLM_SPEND_30D.map((d) => d.amount)} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Spend by task</h2>
          <div className="space-y-2.5">
            {LLM_SPEND_BY_TASK.map((t) => {
              const max = Math.max(...LLM_SPEND_BY_TASK.map((x) => x.amount));
              return (
                <div key={t.task}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span>{t.task}</span>
                    <span className="font-medium">{formatCurrency(t.amount)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(t.amount / max) * 100}%` }} />
                    </div>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{t.model}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function Sparkbars({ data }: { data: number[] }) {
  const max = Math.max(...data);
  return (
    <div className="mt-4 flex h-32 items-end gap-1">
      {data.map((v, i) => (
        <div key={i} className="group relative flex-1">
          <div
            className="w-full rounded-t bg-gradient-to-t from-primary/40 to-primary transition-all hover:from-primary hover:to-primary"
            style={{ height: `${Math.max(4, (v / max) * 128)}px` }}
          />
          <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-[10px] opacity-0 shadow-panel transition-opacity group-hover:opacity-100">
            {formatCurrency(v)}
          </div>
        </div>
      ))}
    </div>
  );
}
