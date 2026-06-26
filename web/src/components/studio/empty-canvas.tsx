"use client";

import * as React from "react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { GenerateDialog } from "./generate-dialog";
import { useStudio } from "@/lib/store";
import { TEMPLATES } from "@/lib/crg/templates";
import { EXAMPLE_PROMPTS } from "@/lib/crg/generate";
import { Sparkles, LibraryBig, ArrowRight } from "lucide-react";

export function EmptyCanvas() {
  const [prompt, setPrompt] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [autoRun, setAutoRun] = React.useState(false);
  const loadTemplate = useStudio((s) => s.loadTemplate);

  const start = () => {
    if (!prompt.trim()) return;
    setAutoRun(true);
    setOpen(true);
  };

  return (
    <div className="grid h-full w-full place-items-center bg-canvas grid-bg">
      <div className="w-full max-w-xl px-6 text-center animate-fade-in">
        <div className="mb-5 inline-grid place-items-center rounded-2xl bg-card/60 p-4 ring-1 ring-border">
          <LogoMark size={40} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Start from a sentence.</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground text-balance">
          Describe the system you want and a team of AI agents will draft a production-ready,
          cost-estimated architecture onto this canvas.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card/70 p-2 shadow-panel focus-within:ring-2 focus-within:ring-ring">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                start();
              }
            }}
            placeholder="A multi-region e-commerce checkout backend with PCI scope and async fulfilment…"
            className="h-20 w-full resize-none bg-transparent p-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[11px] text-muted-foreground">↵ to generate · routed via LiteLLM</span>
            <Button size="sm" variant="glow" onClick={start} disabled={!prompt.trim()}>
              <Sparkles className="size-3.5" /> Generate
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {EXAMPLE_PROMPTS.slice(0, 3).map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-8">
          <div className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <LibraryBig className="size-3.5" /> or start from a reference architecture
          </div>
          <div className="grid grid-cols-2 gap-2 text-left">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => loadTemplate(t.id)}
                className="group flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-card"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{t.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{t.tags.join(" · ")}</div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <GenerateDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setAutoRun(false);
        }}
        initialPrompt={prompt}
        autoRun={autoRun}
      />
    </div>
  );
}
