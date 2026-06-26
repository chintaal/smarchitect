"use client";

import * as React from "react";
import Link from "next/link";
import { useStudio } from "@/lib/store";
import { useValidation } from "@/lib/hooks";
import { ModelSelector } from "@/components/layout/model-selector";
import { GenerateDialog } from "./generate-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Undo2,
  Redo2,
  LayoutGrid,
  Sparkles,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronLeft,
} from "lucide-react";

export function StudioTopbar() {
  const projectName = useStudio((s) => s.projectName);
  const setProjectName = useStudio((s) => s.setProjectName);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const autoLayout = useStudio((s) => s.runAutoLayout);
  const variant = "AWS";
  const validation = useValidation();
  const [genOpen, setGenOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
      <Link href="/dashboard" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        <ChevronLeft className="size-4" />
      </Link>

      <div className="flex min-w-0 items-center gap-2">
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="min-w-0 max-w-[260px] truncate rounded-md bg-transparent px-1.5 py-1 text-sm font-semibold outline-none transition-colors hover:bg-accent/60 focus:bg-accent focus:ring-1 focus:ring-ring"
        />
        <Badge variant="secondary" className="shrink-0 text-[10px]">{variant}</Badge>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="flex items-center gap-0.5">
        <IconBtn label="Undo (⌘Z)" onClick={undo} disabled={!canUndo}><Undo2 className="size-4" /></IconBtn>
        <IconBtn label="Redo (⌘⇧Z)" onClick={redo} disabled={!canRedo}><Redo2 className="size-4" /></IconBtn>
        <IconBtn label="Auto-layout" onClick={autoLayout}><LayoutGrid className="size-4" /></IconBtn>
      </div>

      <ValidationPill validation={validation} />

      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setGenOpen(true)}>
          <Sparkles className="size-3.5 text-primary" /> Generate
        </Button>
        <Button size="sm" variant="default" asChild>
          <Link href="/iac">
            <Package className="size-3.5" /> Export IaC
          </Link>
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <ModelSelector />
      </div>

      <GenerateDialog open={genOpen} onOpenChange={setGenOpen} />
    </header>
  );
}

function IconBtn({ label, children, ...props }: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          {...props}
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ValidationPill({ validation }: { validation: ReturnType<typeof useValidation> }) {
  const { errorCount, warningCount } = validation;
  const ok = errorCount === 0 && warningCount === 0;
  return (
    <div
      className={cn(
        "ml-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        errorCount > 0 ? "bg-destructive/15 text-destructive" : warningCount > 0 ? "bg-warning/15 text-warning" : "bg-success/15 text-success",
      )}
    >
      {errorCount > 0 ? <XCircle className="size-3.5" /> : warningCount > 0 ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
      {ok ? "Valid" : errorCount > 0 ? `${errorCount} error${errorCount === 1 ? "" : "s"}` : `${warningCount} warning${warningCount === 1 ? "" : "s"}`}
    </div>
  );
}
