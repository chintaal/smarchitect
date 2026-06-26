"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PROJECTS, ACTIVITY } from "@/lib/data/mock";
import { PROVIDER_META } from "@/lib/crg/catalog";
import { useStudio } from "@/lib/store";
import { formatCurrency, relativeTime, cn } from "@/lib/utils";
import {
  Plus,
  Boxes,
  Wallet,
  ShieldCheck,
  Layers,
  ArrowUpRight,
  Sparkles,
  GitBranch,
  Download,
  Activity as ActivityIcon,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const newBlank = useStudio((s) => s.newBlank);

  const totalSpend = PROJECTS.reduce((s, p) => s + p.monthlyEstimate, 0);
  const totalNodes = PROJECTS.reduce((s, p) => s + p.nodeCount, 0);
  const avgCompliance = Math.round(PROJECTS.reduce((s, p) => s + p.complianceScore, 0) / PROJECTS.length);

  const startNew = () => {
    newBlank();
    router.push("/studio");
  };

  return (
    <PageShell
      title="Dashboard"
      description="Projects, recent activity, and platform cost at a glance"
      actions={
        <Button size="sm" variant="glow" onClick={startNew}>
          <Plus className="size-4" /> New architecture
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Layers} label="Projects" value={String(PROJECTS.length)} sub="2 active · 1 imported" />
        <Kpi icon={Wallet} label="Monthly estimate" value={formatCurrency(totalSpend, { compact: true })} sub="across all variants" tone="primary" />
        <Kpi icon={ShieldCheck} label="Avg compliance" value={`${avgCompliance}%`} sub="weighted by controls" tone={avgCompliance >= 80 ? "success" : "warning"} />
        <Kpi icon={Boxes} label="Resources tracked" value={String(totalNodes)} sub="designed + imported" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Projects</h2>
            <span className="text-xs text-muted-foreground">{PROJECTS.length} total</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROJECTS.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
            <button
              onClick={startNew}
              className="flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <div className="grid size-9 place-items-center rounded-lg bg-primary/10">
                <Sparkles className="size-4 text-primary" />
              </div>
              <span className="text-sm font-medium">New from a prompt</span>
            </button>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
          <Card className="divide-y divide-border">
            {ACTIVITY.map((a) => (
              <div key={a.id} className="flex gap-3 p-3.5">
                <div className={cn("grid size-8 shrink-0 place-items-center rounded-lg", kindStyle(a.kind))}>
                  <KindIcon kind={a.kind} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug">
                    <span className="font-medium">{a.who}</span> <span className="text-muted-foreground">{a.action}</span>{" "}
                    <span className="font-medium">{a.target}</span>
                  </p>
                  <span className="text-[11px] text-muted-foreground">{relativeTime(a.at)}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "primary" | "success" | "warning";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon
          className={cn(
            "size-4",
            tone === "primary" && "text-primary",
            tone === "success" && "text-success",
            tone === "warning" && "text-warning",
            tone === "default" && "text-muted-foreground",
          )}
        />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </Card>
  );
}

function ProjectCard({ project: p }: { project: (typeof PROJECTS)[number] }) {
  return (
    <Link href="/studio" className="group">
      <Card className="h-full p-4 transition-all hover:border-primary/40 hover:shadow-panel">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{p.name}</h3>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{p.description}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {p.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Badge variant="outline" className="text-[10px] uppercase">{PROVIDER_META[p.variant === "multi" ? "aws" : (p.variant as "aws")]?.short ?? "Multi"}</Badge>
          <span className="text-[11px] text-muted-foreground">{p.nodeCount} resources</span>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Compliance</span>
            <span className={cn("font-medium", p.complianceScore >= 80 ? "text-success" : p.complianceScore >= 60 ? "text-warning" : "text-destructive")}>
              {p.complianceScore}%
            </span>
          </div>
          <Progress
            value={p.complianceScore}
            indicatorClassName={cn(p.complianceScore >= 80 ? "bg-success" : p.complianceScore >= 60 ? "bg-warning" : "bg-destructive")}
          />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-semibold">{formatCurrency(p.monthlyEstimate, { compact: true })}<span className="text-[11px] font-normal text-muted-foreground">/mo</span></span>
          <span className="text-[11px] text-muted-foreground">{relativeTime(p.updatedAt)}</span>
        </div>
      </Card>
    </Link>
  );
}

function kindStyle(kind: string) {
  switch (kind) {
    case "generate":
      return "bg-primary/15 text-primary";
    case "compliance":
      return "bg-success/15 text-success";
    case "import":
      return "bg-warning/15 text-warning";
    case "deploy":
      return "bg-primary/15 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function KindIcon({ kind }: { kind: string }) {
  const cls = "size-4";
  switch (kind) {
    case "generate":
      return <Sparkles className={cls} />;
    case "compliance":
      return <ShieldCheck className={cls} />;
    case "import":
      return <Download className={cls} />;
    case "deploy":
      return <GitBranch className={cls} />;
    default:
      return <ActivityIcon className={cls} />;
  }
}
