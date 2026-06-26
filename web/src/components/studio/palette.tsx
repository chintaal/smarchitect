"use client";

import * as React from "react";
import { CATALOG, CATEGORY_META, CATEGORY_ORDER, PROVIDER_META } from "@/lib/crg/catalog";
import type { CatalogService } from "@/lib/crg/catalog";
import type { CloudProvider, ServiceCategory } from "@/lib/crg/types";
import { ServiceIcon } from "@/components/brand/service-icon";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ChevronRight, Search } from "lucide-react";

const PROVIDERS: (CloudProvider | "all")[] = ["all", "aws", "azure", "gcp", "k8s"];

export function Palette() {
  const [query, setQuery] = React.useState("");
  const [provider, setProvider] = React.useState<CloudProvider | "all">("all");
  const [collapsed, setCollapsed] = React.useState<Set<ServiceCategory>>(new Set());
  const addNode = useStudio((s) => s.addNodeFromService);

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase();
    return CATALOG.filter((s) => {
      if (provider !== "all" && s.provider !== provider) return false;
      if (!q) return true;
      return (
        s.label.toLowerCase().includes(q) ||
        s.fullName.toLowerCase().includes(q) ||
        s.category.includes(q) ||
        s.provider.includes(q)
      );
    });
  }, [query, provider]);

  const byCategory = React.useMemo(() => {
    const map = new Map<ServiceCategory, CatalogService[]>();
    for (const s of filtered) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return map;
  }, [filtered]);

  const toggle = (c: ServiceCategory) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });

  const onDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData("application/smarchitect-service", key);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex h-full w-[256px] shrink-0 flex-col border-r border-border bg-card/40">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 40+ services…"
            className="h-8 w-full rounded-lg border border-input bg-background/40 pl-8 pr-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="mt-2 flex gap-1">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={cn(
                "flex-1 rounded-md px-1.5 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors",
                provider === p ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {p === "all" ? "All" : PROVIDER_META[p].short}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((cat) => {
          const items = byCategory.get(cat)!;
          const meta = CATEGORY_META[cat];
          const isCollapsed = collapsed.has(cat);
          return (
            <div key={cat} className="mb-1">
              <button
                onClick={() => toggle(cat)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/60"
              >
                <ChevronRight className={cn("size-3 text-muted-foreground transition-transform", !isCollapsed && "rotate-90")} />
                <span className="size-2 rounded-full" style={{ background: meta.from }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{items.length}</span>
              </button>
              {!isCollapsed && (
                <div className="mt-0.5 space-y-0.5">
                  {items.map((s) => (
                    <div
                      key={s.key}
                      draggable
                      onDragStart={(e) => onDragStart(e, s.key)}
                      onClick={() => addNode(s.key, { x: 240 + Math.random() * 200, y: 160 + Math.random() * 160 })}
                      className="group flex cursor-grab items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent active:cursor-grabbing"
                      title={`${s.fullName} — drag onto the canvas or click to add`}
                    >
                      <ServiceIcon serviceType={s.key} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium">{s.label}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{PROVIDER_META[s.provider].short}</div>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                        ${s.baseCost}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">No services match “{query}”.</div>
        )}
      </div>

      <div className="border-t border-border p-3 text-[10px] text-muted-foreground">
        Drag onto the canvas, or click to drop. Official taxonomy across {Object.keys(PROVIDER_META).length} providers.
      </div>
    </div>
  );
}
