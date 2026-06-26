"use client";

import * as React from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MODELS } from "@/lib/data/mock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Cpu, Wallet, KeyRound, Zap, Gauge, Rocket } from "lucide-react";

const LATENCY = { fast: { icon: Zap, label: "Fast" }, balanced: { icon: Gauge, label: "Balanced" }, frontier: { icon: Rocket, label: "Frontier" } } as const;

export default function SettingsPage() {
  const [models, setModels] = React.useState(MODELS);

  const toggle = (id: string) =>
    setModels((m) => m.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)));

  return (
    <PageShell title="Settings" description="LiteLLM gateway, budgets, and provider credentials">
      <Tabs defaultValue="models" className="w-full">
        <TabsList>
          <TabsTrigger value="models"><Cpu className="size-3.5" /> Models</TabsTrigger>
          <TabsTrigger value="budgets"><Wallet className="size-3.5" /> Budgets</TabsTrigger>
          <TabsTrigger value="providers"><KeyRound className="size-3.5" /> Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="mt-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">LiteLLM model routing</h2>
                <p className="text-xs text-muted-foreground">One OpenAI-compatible endpoint · routing, fallback, and budgets in YAML.</p>
              </div>
              <Badge variant="success" className="text-[10px]">Gateway online</Badge>
            </div>
            <div className="space-y-1.5">
              {models.map((m) => {
                const L = LATENCY[m.latency];
                return (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3">
                    <div className={cn("grid size-8 place-items-center rounded-lg", m.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                      <L.icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{m.label}</span>
                        <Badge variant="outline" className="text-[9px]">{m.provider}</Badge>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">{m.id} · {m.role}</div>
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground">
                      <div>${m.inputCost} in / ${m.outputCost} out</div>
                      <div className="text-[10px]">per 1M tokens</div>
                    </div>
                    <Switch checked={m.enabled} onCheckedChange={() => toggle(m.id)} />
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="budgets" className="mt-4">
          <Card className="max-w-xl p-5">
            <h2 className="text-sm font-semibold">Spend budgets</h2>
            <p className="mb-4 text-xs text-muted-foreground">Per-project caps enforced by the LiteLLM proxy; low-stakes tasks route to cheap models.</p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Monthly budget per project (USD)</Label>
                <Input type="number" defaultValue={250} />
              </div>
              <div className="space-y-1.5">
                <Label>Alert threshold (%)</Label>
                <Input type="number" defaultValue={80} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Route low-stakes tasks to cheap models</div>
                  <div className="text-[11px] text-muted-foreground">Node labels & cost math use Haiku-class models</div>
                </div>
                <Switch defaultChecked />
              </div>
              <Button onClick={() => toast.success("Budgets saved")}>Save budgets</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="mt-4">
          <Card className="max-w-xl p-5">
            <h2 className="text-sm font-semibold">Provider credentials</h2>
            <p className="mb-4 text-xs text-muted-foreground">Stored as encrypted virtual keys in the gateway. Read-only for discovery.</p>
            <div className="space-y-3">
              {["OpenAI", "Anthropic", "Google AI", "AWS Bedrock"].map((p) => (
                <div key={p} className="space-y-1.5">
                  <Label>{p} API key</Label>
                  <Input type="password" defaultValue="sk-••••••••••••••••••••" className="font-mono" />
                </div>
              ))}
              <Button onClick={() => toast.success("Credentials updated")}>Save credentials</Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
