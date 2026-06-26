"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="z-30 flex h-screen w-[236px] shrink-0 flex-col border-r border-border bg-card/40">
      <div className="flex h-14 items-center px-4">
        <Link href="/dashboard" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3 scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/12 text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <Icon className={cn("size-[18px] shrink-0", active && "text-primary")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[200px]">
                {item.description}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/studio"
          className="flex items-center gap-3 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 px-3 py-2.5 ring-1 ring-primary/20 transition-all hover:ring-primary/40"
        >
          <div className="grid size-8 place-items-center rounded-md bg-primary/15">
            <Sparkles className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold">New architecture</div>
            <div className="truncate text-[11px] text-muted-foreground">Describe it in plain language</div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
