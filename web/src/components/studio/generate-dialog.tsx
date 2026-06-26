"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStudio } from "@/lib/store";
import { generateFromPrompt, EXAMPLE_PROMPTS, type GenerateResult } from "@/lib/crg/generate";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { summarizeCost } from "@/lib/crg/cost";
import {
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  ClipboardList,
  Search,
  Boxes,
  DollarSign,
  ShieldAlert,
  ScrollText,
  CircleHelp,
} from "lucide-react";
import { toast } from "sonner";

interface Stage {
  id: string;
  label: string;
  detail: string;
  model: string;
  icon: React.ElementType;
}

const STAGES: Stage[] = [
  { id: "req", label: "Requirements Analyst", detail: "Parsing your brief into a structured spec", model: "Claude Sonnet 4.6", icon: ClipboardList },
  { id: "research", label: "Research Agent", detail: "Pulling current service docs + pricing", model: "Gemini 2.5 Pro", icon: Search },
  { id: "architect", label: "Architect Agent", detail: "Designing a production-ready graph", model: "Claude Opus 4.8", icon: Boxes },
  { id: "cost", label: "Cost & Sizing Agent", detail: "Estimating monthly cost with confidence bands", model: "Claude Haiku 4.5", icon: DollarSign },
  { id: "security", label: "Security Critic", detail: "Auditing for SPOFs, exposure, encryption gaps", model: "Claude Opus 4.8", icon: ShieldAlert },
  { id: "compliance", label: "Compliance Agent", detail: "Mapping controls to named catalogs", model: "Claude Sonnet 4.6", icon: ScrollText },
];

export function GenerateDialog({
  open,
  onOpenChange,
  initialPrompt = "",
  autoRun = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialPrompt?: string;
  autoRun?: boolean;
}) {
  const [prompt, setPrompt] = React.useState(initialPrompt);
  const [phase, setPhase] = React.useState<"input" | "running" | "done">("input");
  const [activeStage, setActiveStage] = React.useState(-1);
  const [result, setResult] = React.useState<GenerateResult | null>(null);
  const replaceGraph = useStudio((s) => s.replaceGraph);
  const setProjectName = useStudio((s) => s.setProjectName);

  React.useEffect(() => {
    if (open) {
      setPrompt(initialPrompt);
      setPhase("input");
      setActiveStage(-1);
      setResult(null);
      if (autoRun && initialPrompt.trim()) {
        // start on next tick so state settles
        setTimeout(() => run(initialPrompt), 50);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const run = (text: string) => {
    if (!text.trim()) return;
    const res = generateFromPrompt(text);
    setResult(res);
    setPhase("running");
    setActiveStage(0);

    let i = 0;
    const tick = () => {
      i += 1;
      if (i < STAGES.length) {
        setActiveStage(i);
        timer = window.setTimeout(tick, 520);
      } else {
        setActiveStage(STAGES.length);
        window.setTimeout(() => setPhase("done"), 420);
      }
    };
    let timer = window.setTimeout(tick, 520);
  };

  const apply = () => {
    if (!result) return;
    replaceGraph(result.graph, "generate", `Generated "${result.projectName}"`, result.graph.nodes.length);
    setProjectName(result.projectName);
    onOpenChange(false);
    toast.success("Architecture generated", {
      description: `${result.graph.nodes.length} resources streamed onto the canvas.`,
    });
  };

  const cost = result ? summarizeCost(result.graph) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        {phase === "input" && (
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-primary/15">
                <Sparkles className="size-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Describe your system</h2>
                <p className="text-xs text-muted-foreground">
                  A team of AI agents will draft a production-ready architecture onto the canvas.
                </p>
              </div>
            </div>
            <textarea
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(prompt);
              }}
              placeholder="e.g. A HIPAA-compliant patient records API with async document processing, multi-AZ, in us-east-1…"
              className="h-28 w-full resize-none rounded-lg border border-input bg-background/40 p-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Routed through the LiteLLM gateway · <kbd className="font-mono">⌘↵</kbd> to generate
              </span>
              <Button variant="glow" onClick={() => run(prompt)} disabled={!prompt.trim()}>
                <Sparkles className="size-4" /> Generate architecture
              </Button>
            </div>
          </div>
        )}

        {phase === "running" && (
          <div className="p-6">
            <h2 className="mb-1 text-base font-semibold">Agents at work</h2>
            <p className="mb-5 text-xs text-muted-foreground">
              LangGraph pipeline · human-approval checkpoints between every stage.
            </p>
            <div className="space-y-1.5">
              {STAGES.map((stage, idx) => {
                const done = idx < activeStage;
                const active = idx === activeStage;
                const Icon = stage.icon;
                return (
                  <div
                    key={stage.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all",
                      active ? "border-primary/40 bg-primary/5" : done ? "border-border bg-card" : "border-border/50 opacity-50",
                    )}
                  >
                    <div
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md",
                        done ? "bg-success/15 text-success" : active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="size-4" /> : active ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{stage.label}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{stage.detail}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                      {stage.model}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {phase === "done" && result && cost && (
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-success/15">
                <Check className="size-4 text-success" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{result.projectName}</h2>
                <p className="text-xs text-muted-foreground">Requirements confirmed · ready to edit on the canvas.</p>
              </div>
            </div>

            <p className="mb-4 rounded-lg border border-border bg-card/60 p-3 text-[13px] leading-relaxed text-muted-foreground">
              {result.rationale}
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <SpecBlock title="Workloads" items={result.spec.workloads} />
              <SpecBlock title="Non-functional reqs" items={result.spec.nfrs} />
              <SpecBlock title="Regions" items={result.spec.regions} />
              <SpecBlock title="Compliance" items={result.spec.complianceTags.length ? result.spec.complianceTags : ["None specified"]} />
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-card/60 p-3">
              <DollarSign className="size-4 text-primary" />
              <div className="text-sm">
                <span className="font-semibold">{formatCurrency(cost.total)}</span>
                <span className="text-muted-foreground"> / mo estimate · {result.graph.nodes.length} resources</span>
              </div>
            </div>

            {result.spec.clarifyingQuestions.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CircleHelp className="size-3.5" /> Clarifying questions from the analyst
                </div>
                <ul className="space-y-1">
                  {result.spec.clarifyingQuestions.map((q) => (
                    <li key={q} className="text-[12px] text-muted-foreground">
                      • {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPhase("input")}>
                Refine brief
              </Button>
              <Button variant="glow" onClick={apply}>
                Open on canvas <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SpecBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => (
          <span key={it} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
