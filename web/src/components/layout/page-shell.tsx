"use client";

import { useUi } from "@/lib/ui-store";
import { ModelSelector } from "./model-selector";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageShell({
  title,
  description,
  actions,
  children,
  contentClassName,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  const setCommandOpen = useUi((s) => s.setCommandOpen);

  return (
    <div className="flex h-screen flex-col">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold leading-tight">{title}</h1>
          {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <button
            onClick={() => setCommandOpen(true)}
            className="flex h-8 items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="ml-1 hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
          </button>
          <ModelSelector />
        </div>
      </header>
      <div className={cn("flex-1 overflow-y-auto scrollbar-thin", contentClassName)}>
        <div className="mx-auto max-w-[1400px] px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
