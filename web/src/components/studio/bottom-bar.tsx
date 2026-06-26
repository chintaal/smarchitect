"use client";

import * as React from "react";
import { useStudio } from "@/lib/store";
import { useCostSummary, useValidation } from "@/lib/hooks";
import { diffGraphs } from "@/lib/crg/diff";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ServiceIcon } from "@/components/brand/service-icon";
import { formatCurrency, relativeTime, cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { History, GitCompare, DollarSign, CheckCircle2, AlertTriangle, XCircle, Plus, Minus, PencilLine } from "lucide-react";

export function BottomBar() {
  const graph = useStudio((s) => s.graph);
  const past = useStudio((s) => s.past);
  const patchHistory = useStudio((s) => s.patchHistory);
  const cost = useCostSummary();
  const validation = useValidation();
  const [diffOpen, setDiffOpen] = React.useState(false);

  const diff = past.length > 0 ? diffGraphs(past[past.length - 1], graph) : null;

  return (
    <div className="z-20 flex h-9 shrink-0 items-center gap-3 border-t border-border bg-card/60 px-4 text-xs">
      {/* Version history */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded px-1.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <History className="size-3.5" />
          <span>v{past.length + 1}</span>
          <span className="text-muted-foreground/60">· {patchHistory.length} changes</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-72">
          <DropdownMenuLabel>Version history</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {patchHistory.length === 0 && (
            <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">No changes yet.</div>
          )}
          {patchHistory.slice(0, 8).map((p) => (
            <DropdownMenuItem key={p.id} className="flex-col items-start gap-0.5">
              <div className="flex w-full items-center justify-between">
                <span className="font-medium text-foreground">{p.summary}</span>
                <Badge variant="muted" className="text-[9px]">{p.changeCount}</Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {p.appliedBy} · {relativeTime(p.appliedAt)}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={() => setDiffOpen(true)}
        disabled={!diff}
        className="flex items-center gap-1.5 rounded px-1.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
      >
        <GitCompare className="size-3.5" /> Diff last change
        {diff && (diff.added.length || diff.removed.length || diff.changed.length) > 0 && (
          <span className="text-primary">
            (+{diff.added.length} -{diff.removed.length} ~{diff.changed.length})
          </span>
        )}
      </button>

      <div className="ml-auto flex items-center gap-3">
        <ValidationSummary validation={validation} />
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <DollarSign className="size-3.5 text-primary" />
          <span className="font-medium">{formatCurrency(cost.total)}</span>
          <span className="text-muted-foreground">/mo</span>
          <span className="text-muted-foreground/60">
            ({formatCurrency(cost.low, { compact: true })}–{formatCurrency(cost.high, { compact: true })})
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="text-muted-foreground">
          {graph.nodes.length} nodes · {graph.edges.length} edges
        </span>
      </div>

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="size-4 text-primary" /> Version diff
            </DialogTitle>
            <DialogDescription>Before / after of your most recent change.</DialogDescription>
          </DialogHeader>
          {diff && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={diff.costDelta > 0 ? "warning" : diff.costDelta < 0 ? "success" : "muted"}>
                  {diff.costDelta >= 0 ? "+" : ""}
                  {formatCurrency(diff.costDelta)}/mo
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {diff.edgesAdded} edges added · {diff.edgesRemoved} removed
                </span>
              </div>
              <div className="max-h-[340px] space-y-1.5 overflow-y-auto scrollbar-thin">
                {diff.added.map((n) => (
                  <DiffRow key={n.id} icon={<Plus className="size-3.5 text-success" />} node={n} label="Added" tone="success" />
                ))}
                {diff.removed.map((n) => (
                  <DiffRow key={n.id} icon={<Minus className="size-3.5 text-destructive" />} node={n} label="Removed" tone="destructive" />
                ))}
                {diff.changed.map((c) => (
                  <div key={c.node.id} className="rounded-lg border border-border bg-card/50 p-2.5">
                    <div className="flex items-center gap-2">
                      <ServiceIcon serviceType={c.node.serviceType} size={24} />
                      <span className="text-[13px] font-medium">{c.node.name}</span>
                      <PencilLine className="size-3 text-warning" />
                    </div>
                    <div className="mt-1.5 space-y-0.5 pl-8">
                      {c.fields.map((f) => (
                        <div key={f.field} className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-muted-foreground">{f.field}:</span>
                          <span className="text-destructive line-through">{f.before}</span>
                          <span>→</span>
                          <span className="text-success">{f.after}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No structural differences.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DiffRow({ icon, node, label, tone }: { icon: React.ReactNode; node: { serviceType: string; name: string }; label: string; tone: "success" | "destructive" }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/50 p-2.5">
      <ServiceIcon serviceType={node.serviceType} size={24} />
      <span className="text-[13px] font-medium">{node.name}</span>
      <span className={cn("ml-auto flex items-center gap-1 text-[11px]", tone === "success" ? "text-success" : "text-destructive")}>
        {icon} {label}
      </span>
    </div>
  );
}

function ValidationSummary({ validation }: { validation: ReturnType<typeof useValidation> }) {
  const { errorCount, warningCount, infoCount } = validation;
  if (errorCount === 0 && warningCount === 0 && infoCount === 0) {
    return (
      <span className="flex items-center gap-1.5 text-success">
        <CheckCircle2 className="size-3.5" /> All checks pass
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded px-1.5 py-0.5 transition-colors hover:bg-accent">
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="size-3.5" /> {errorCount}
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-warning">
            <AlertTriangle className="size-3.5" /> {warningCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-80">
        <DropdownMenuLabel>Validation ({validation.issues.length})</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto scrollbar-thin">
          {validation.issues.map((issue) => (
            <div key={issue.id} className="flex gap-2 px-2 py-1.5">
              {issue.severity === "error" ? (
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              ) : issue.severity === "warning" ? (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              ) : (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              )}
              <div>
                <div className="text-[12px] font-medium">{issue.title}</div>
                <div className="text-[11px] text-muted-foreground">{issue.detail}</div>
                {issue.fix && <div className="mt-0.5 text-[11px] text-primary">→ {issue.fix}</div>}
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
