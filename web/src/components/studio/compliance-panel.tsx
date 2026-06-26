"use client";

import * as React from "react";
import { useStudio } from "@/lib/store";
import { useLensResult } from "@/lib/hooks";
import { FRAMEWORKS, getFramework, remediateControl, remediateFramework } from "@/lib/crg/compliance";
import type { ControlStatus } from "@/lib/crg/compliance/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ShieldCheck, Wand2, ChevronDown, CircleCheck, CircleX, CircleMinus, CircleDashed, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function CompliancePanel() {
  const lensId = useStudio((s) => s.lensFrameworkId);
  const setLens = useStudio((s) => s.setLens);
  const replaceGraph = useStudio((s) => s.replaceGraph);
  const result = useLensResult();
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const remediateAll = () => {
    if (!lensId) return;
    const fw = getFramework(lensId)!;
    const next = remediateFramework(fw, useStudio.getState().graph);
    replaceGraph(next, "remediate", `Remediated ${fw.short} findings`, fw.controls.length);
    toast.success(`${fw.short} remediation applied`, { description: "Failing controls were auto-fixed on the canvas." });
  };

  const remediateOne = (controlId: string) => {
    if (!lensId) return;
    const fw = getFramework(lensId)!;
    const next = remediateControl(fw, controlId, useStudio.getState().graph);
    replaceGraph(next, "remediate", `Remediated ${controlId}`, 1);
    toast.success(`Fixed ${controlId}`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-primary/15">
            <ShieldCheck className="size-4 text-primary" />
          </div>
          <div>
            <div className="text-[13px] font-semibold">Compliance lens</div>
            <div className="text-[11px] text-muted-foreground">Overlays grounded in real control catalogs</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {FRAMEWORKS.map((fw) => {
            const active = lensId === fw.id;
            return (
              <button
                key={fw.id}
                onClick={() => setLens(fw.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-all",
                  active ? "border-primary/50 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {active ? <Eye className="size-3.5 text-primary" /> : <EyeOff className="size-3.5" />}
                <span className="truncate">{fw.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!result ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-muted">
            <ShieldCheck className="size-6 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium">Toggle a framework</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nodes on the canvas will light up green (pass), amber (partial) or red (fail) against the selected controls.
          </p>
        </div>
      ) : (
        <>
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-4">
              <ScoreRing score={result.score} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{result.framework.name}</div>
                <div className="text-[11px] text-muted-foreground">{result.framework.catalog}</div>
                <div className="mt-1.5 flex gap-1.5">
                  <Badge variant="success" className="text-[10px]"><CircleCheck className="size-2.5" /> {result.passCount} pass</Badge>
                  {result.partialCount > 0 && <Badge variant="warning" className="text-[10px]">{result.partialCount} partial</Badge>}
                  {result.failCount > 0 && <Badge variant="destructive" className="text-[10px]"><CircleX className="size-2.5" /> {result.failCount} fail</Badge>}
                </div>
              </div>
            </div>
            {(result.failCount > 0 || result.partialCount > 0) && (
              <Button variant="glow" size="sm" className="mt-3 w-full" onClick={remediateAll}>
                <Wand2 className="size-3.5" /> One-click remediate all
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
            {result.framework.controls.map((control) => {
              const ev = result.controls.find((c) => c.controlId === control.id)!;
              const open = expanded === control.id;
              return (
                <div key={control.id} className="mb-1 rounded-lg border border-border/70 bg-card/40">
                  <button
                    onClick={() => setExpanded(open ? null : control.id)}
                    className="flex w-full items-start gap-2.5 p-2.5 text-left"
                  >
                    <StatusIcon status={ev.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground">{control.id}</span>
                      </div>
                      <div className="text-[12px] font-medium leading-snug">{control.title}</div>
                      {!open && <div className="truncate text-[11px] text-muted-foreground">{ev.evidence}</div>}
                    </div>
                    <ChevronDown className={cn("mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                  </button>
                  {open && (
                    <div className="space-y-2 border-t border-border/60 px-2.5 pb-2.5 pt-2">
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{control.description}</p>
                      <div className="rounded-md bg-muted/60 px-2 py-1.5 text-[11px]">
                        <span className="font-medium text-foreground">Evidence: </span>
                        <span className="text-muted-foreground">{ev.evidence}</span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">{control.ref}</div>
                      {(ev.status === "fail" || ev.status === "partial") && control.remediate && (
                        <Button variant="outline" size="sm" className="w-full" onClick={() => remediateOne(control.id)}>
                          <Wand2 className="size-3.5" /> {control.remediation}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: ControlStatus }) {
  if (status === "pass") return <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />;
  if (status === "fail") return <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" />;
  if (status === "partial") return <CircleMinus className="mt-0.5 size-4 shrink-0 text-warning" />;
  return <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "hsl(var(--success))" : score >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative grid size-14 shrink-0 place-items-center">
      <svg className="size-14 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-sm font-bold">{score}</span>
    </div>
  );
}
