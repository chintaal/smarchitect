import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ServiceIcon } from "@/components/brand/service-icon";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  PenTool,
  ShieldCheck,
  Package,
  Download,
  GitCompare,
  Cpu,
  Boxes,
} from "lucide-react";

const PLANES = [
  { name: "Canvas", desc: "React Flow editor, custom nodes, talk-to-edit, compliance lens", icon: PenTool },
  { name: "Agents", desc: "LangGraph pipeline routed through the LiteLLM gateway", icon: Cpu },
  { name: "Graph", desc: "Provider-agnostic Cloud Resource Graph, versioned", icon: Boxes },
  { name: "Policy", desc: "OSCAL catalogs + OPA/Rego, overlays as graph transforms", icon: ShieldCheck },
  { name: "IaC", desc: "Pulumi Automation API, multi-format export, preview/plan", icon: Package },
  { name: "Import", desc: "Live AWS/Azure/GCP discovery, TF-state, drift detection", icon: Download },
];

const FEATURES = [
  { title: "Diagram builder", desc: "An infinite canvas with custom resource nodes, drag-from-palette, auto-layout and live validation.", icon: PenTool },
  { title: "Talk to edit", desc: "“Add a Redis cache between the API and the database.” The graph mutates live, model-agnostic via LiteLLM.", icon: Sparkles },
  { title: "Zero Trust lens", desc: "Toggle NIST 800-207 and watch nodes light up pass/fail — one-click remediation with audit evidence.", icon: ShieldCheck },
  { title: "Real IaC", desc: "One graph → Pulumi, Terraform, Helm, CloudFormation. Preview the plan before you ship.", icon: Package },
  { title: "Version diff", desc: "Visual before/after between any two versions, with cost delta and a full patch log.", icon: GitCompare },
  { title: "Multi-cloud aggregator", desc: "Import live accounts and Terraform state into the same canvas; detect drift.", icon: Download },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* nav */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/templates">Templates</Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link href="/dashboard">
                Open app <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px]" />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> AI-native cloud architecture · powered by LiteLLM
          </div>
          <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            Design, comply, and ship cloud infrastructure <span className="gradient-text">from one canvas.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
            Describe a system in plain language. A team of AI agents drafts a production-ready architecture onto an
            interactive diagram — then estimates cost, audits Zero Trust, and generates deployable IaC across AWS, Azure
            and GCP.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="xl" variant="glow" asChild>
              <Link href="/studio">
                <Sparkles className="size-4" /> Open the Design Studio
              </Link>
            </Button>
            <Button size="xl" variant="outline" asChild>
              <Link href="/dashboard">View dashboard</Link>
            </Button>
          </div>

          {/* faux canvas strip */}
          <div className="mx-auto mt-14 max-w-3xl rounded-2xl border border-border bg-card/50 p-5 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              {["aws.cloudfront", "aws.alb", "aws.ecs", "aws.rds"].map((k, i) => (
                <div key={k} className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-2">
                    <ServiceIcon serviceType={k} size={44} />
                  </div>
                  {i < 3 && <div className="h-px w-8 bg-gradient-to-r from-primary/60 to-primary/20 sm:w-16" />}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-success" /> Valid</span>
              <span>·</span>
              <span>Zero Trust 86%</span>
              <span>·</span>
              <span>$4,820/mo</span>
            </div>
          </div>
        </div>
      </section>

      {/* one graph four directions */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">One graph, five planes</h2>
          <p className="mt-2 text-muted-foreground">A single Cloud Resource Graph is the source of truth for everything.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLANES.map((p) => (
            <div key={p.name} className="rounded-xl border border-border bg-card/40 p-5 transition-colors hover:border-primary/40">
              <div className="mb-3 grid size-9 place-items-center rounded-lg bg-primary/10">
                <p.icon className="size-5 text-primary" />
              </div>
              <div className="text-sm font-semibold">{p.name} plane</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card/40 p-5">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-border bg-gradient-to-b from-card/60 to-card/20 p-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Walk in with a sentence. Walk out with deployable IaC.</h2>
          <Button size="lg" variant="glow" asChild>
            <Link href="/studio">
              Start designing <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <Logo size={22} />
          <span>SmArchitect — Smart Architect · auth intentionally out of scope</span>
        </div>
      </footer>
    </div>
  );
}
