"use client";

import { useUi } from "@/lib/ui-store";
import { MODELS } from "@/lib/data/mock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronsUpDown, Cpu, Gauge, Rocket, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const LATENCY_ICON = { fast: Zap, balanced: Gauge, frontier: Rocket } as const;

export function ModelSelector() {
  const active = useUi((s) => s.activeModel);
  const setActive = useUi((s) => s.setActiveModel);

  const activeLabel = active === "auto" ? "Auto-route" : MODELS.find((m) => m.id === active)?.label ?? "Auto-route";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 text-xs font-medium transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Cpu className="size-3.5 text-primary" />
        <span className="max-w-[120px] truncate">{activeLabel}</span>
        <ChevronsUpDown className="size-3 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>LiteLLM gateway</span>
          <span className="text-[10px] font-normal text-muted-foreground">100+ providers, one endpoint</span>
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setActive("auto")} className="flex-col items-start gap-0.5">
          <div className="flex w-full items-center justify-between">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <Gauge className="size-4 text-primary" /> Auto-route (recommended)
            </span>
            {active === "auto" && <Check className="size-4 text-primary" />}
          </div>
          <span className="pl-6 text-[11px] text-muted-foreground">
            Cheapest capable model per task, with fallback.
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {MODELS.filter((m) => m.enabled).map((m) => {
          const Icon = LATENCY_ICON[m.latency];
          return (
            <DropdownMenuItem key={m.id} onClick={() => setActive(m.id)} className="flex-col items-start gap-0.5">
              <div className="flex w-full items-center justify-between">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <Icon className={cn("size-4", m.latency === "frontier" ? "text-warning" : "text-muted-foreground")} />
                  {m.label}
                </span>
                {active === m.id && <Check className="size-4 text-primary" />}
              </div>
              <span className="pl-6 text-[11px] text-muted-foreground">
                {m.provider} · ${m.inputCost}/${m.outputCost} per 1M · {m.role}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
