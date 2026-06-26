"use client";

import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TEMPLATES } from "@/lib/crg/templates";
import { summarizeCost } from "@/lib/crg/cost";
import { useStudio } from "@/lib/store";
import { ServiceIcon } from "@/components/brand/service-icon";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowRight, Boxes } from "lucide-react";

export default function TemplatesPage() {
  const router = useRouter();
  const loadTemplate = useStudio((s) => s.loadTemplate);

  const use = (id: string, name: string) => {
    loadTemplate(id);
    toast.success(`Loaded "${name}"`, { description: "Opening in the Design Studio…" });
    router.push("/studio");
  };

  return (
    <PageShell title="Templates" description="Production-grade reference architectures to start from">
      <div className="grid gap-4 md:grid-cols-2">
        {TEMPLATES.map((t) => {
          const graph = t.build();
          const cost = summarizeCost(graph);
          const providers = [...new Set(graph.nodes.map((n) => n.provider))];
          const preview = graph.nodes.slice(0, 7);
          return (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{t.name}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{t.description}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {t.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-1.5 rounded-lg border border-border bg-canvas/60 p-3">
                {preview.map((n) => (
                  <ServiceIcon key={n.id} serviceType={n.serviceType} size={30} />
                ))}
                {graph.nodes.length > preview.length && (
                  <span className="ml-1 text-xs text-muted-foreground">+{graph.nodes.length - preview.length}</span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Boxes className="size-3.5" /> {graph.nodes.length} resources
                  </span>
                  <span>{providers.map((p) => p.toUpperCase()).join(" · ")}</span>
                  <span className="font-medium text-foreground">{formatCurrency(cost.total, { compact: true })}/mo</span>
                </div>
                <Button size="sm" variant="glow" onClick={() => use(t.id, t.name)}>
                  Use <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
