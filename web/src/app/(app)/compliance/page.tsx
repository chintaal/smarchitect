"use client";

import * as React from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/store";
import { FRAMEWORKS, evaluateFramework } from "@/lib/crg/compliance";
import type { ControlStatus } from "@/lib/crg/compliance/shared";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ShieldCheck, FileDown, CircleCheck, CircleX, CircleMinus, CircleDashed, ArrowUpRight } from "lucide-react";

export default function CompliancePage() {
  const graph = useStudio((s) => s.graph);
  const projectName = useStudio((s) => s.projectName);
  const setLens = useStudio((s) => s.setLens);
  const results = React.useMemo(() => FRAMEWORKS.map((fw) => evaluateFramework(fw, graph)), [graph]);
  const [selected, setSelected] = React.useState(FRAMEWORKS[0].id);
  const active = results.find((r) => r.framework.id === selected)!;

  const exportAudit = (frameworkId: string) => {
    const res = results.find((r) => r.framework.id === frameworkId)!;
    const doc = {
      "oscal-version": "1.1.2",
      "assessment-results": {
        metadata: {
          title: `${res.framework.name} assessment — ${projectName}`,
          "last-modified": new Date().toISOString(),
          version: "1.0",
          catalog: res.framework.catalog,
          authority: res.framework.authority,
        },
        score: res.score,
        findings: res.framework.controls.map((c) => {
          const ev = res.controls.find((x) => x.controlId === c.id)!;
          return { "control-id": c.id, ref: c.ref, title: c.title, status: ev.status, evidence: ev.evidence, "affected-resources": ev.affectedNodeIds.length };
        }),
      },
    };
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${res.framework.id}-audit.oscal.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit report exported", { description: `OSCAL-backed evidence for ${res.framework.short}.` });
  };

  return (
    <PageShell
      title="Compliance"
      description="Policy-as-code overlays grounded in OSCAL control catalogs"
      actions={
        <Button size="sm" variant="outline" onClick={() => exportAudit(selected)}>
          <FileDown className="size-4" /> Export audit (OSCAL)
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {results.map((r) => (
          <button key={r.framework.id} onClick={() => setSelected(r.framework.id)} className="text-left">
            <Card className={cn("p-4 transition-all hover:border-primary/40", selected === r.framework.id && "border-primary/50 ring-1 ring-primary/30")}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{r.framework.short}</span>
                <ScorePill score={r.score} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{r.framework.authority}</p>
              <div className="mt-3 flex gap-1.5">
                <Badge variant="success" className="text-[10px]">{r.passCount} pass</Badge>
                {r.partialCount > 0 && <Badge variant="warning" className="text-[10px]">{r.partialCount}</Badge>}
                {r.failCount > 0 && <Badge variant="destructive" className="text-[10px]">{r.failCount} fail</Badge>}
              </div>
            </Card>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" /> {active.framework.name}
          </h2>
          <p className="text-xs text-muted-foreground">{active.framework.description}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setLens(active.framework.id);
            toast.success(`${active.framework.short} lens enabled in Studio`);
          }}
          asChild
        >
          <a href="/studio">
            Open lens in Studio <ArrowUpRight className="size-3.5" />
          </a>
        </Button>
      </div>

      <Card className="mt-3 divide-y divide-border">
        {active.framework.controls.map((control) => {
          const ev = active.controls.find((c) => c.controlId === control.id)!;
          return (
            <div key={control.id} className="flex items-start gap-3 p-4">
              <StatusIcon status={ev.status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{control.id}</span>
                  <span className="text-[13px] font-medium">{control.title}</span>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{control.description}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">{ev.evidence}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{control.ref}</span>
                </div>
              </div>
              <Badge
                variant={ev.status === "pass" ? "success" : ev.status === "fail" ? "destructive" : ev.status === "partial" ? "warning" : "muted"}
                className="shrink-0 text-[10px] capitalize"
              >
                {ev.status}
              </Badge>
            </div>
          );
        })}
      </Card>
    </PageShell>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-bold",
        score >= 80 ? "bg-success/15 text-success" : score >= 50 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive",
      )}
    >
      {score}
    </span>
  );
}

function StatusIcon({ status }: { status: ControlStatus }) {
  if (status === "pass") return <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />;
  if (status === "fail") return <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" />;
  if (status === "partial") return <CircleMinus className="mt-0.5 size-4 shrink-0 text-warning" />;
  return <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
}
