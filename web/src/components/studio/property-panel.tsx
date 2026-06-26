"use client";

import { useStudio } from "@/lib/store";
import { getService, PROVIDER_META } from "@/lib/crg/catalog";
import { useCostSummary, useValidation } from "@/lib/hooks";
import { ServiceIcon } from "@/components/brand/service-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import type { HaMode, EdgeKind } from "@/lib/crg/types";
import { Trash2, ArrowLeftRight, Boxes, GitFork, ShieldCheck, AlertTriangle } from "lucide-react";

export function PropertyPanel() {
  const selectedNodeId = useStudio((s) => s.selectedNodeId);
  const selectedEdgeId = useStudio((s) => s.selectedEdgeId);
  const graph = useStudio((s) => s.graph);
  const node = graph.nodes.find((n) => n.id === selectedNodeId);
  const edge = graph.edges.find((e) => e.id === selectedEdgeId);

  if (node) return <NodeProps key={node.id} nodeId={node.id} />;
  if (edge) return <EdgeProps key={edge.id} edgeId={edge.id} />;
  return <GraphOverview />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function NodeProps({ nodeId }: { nodeId: string }) {
  const node = useStudio((s) => s.graph.nodes.find((n) => n.id === nodeId))!;
  const updateNode = useStudio((s) => s.updateNode);
  const updateSecurity = useStudio((s) => s.updateNodeSecurity);
  const removeNode = useStudio((s) => s.removeNode);
  const svc = getService(node.serviceType);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-border p-4">
        <ServiceIcon serviceType={node.serviceType} size={42} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{node.name}</div>
          <div className="truncate text-xs text-muted-foreground">{svc?.fullName}</div>
          <Badge variant="outline" className="mt-1.5 text-[10px]">
            {PROVIDER_META[node.provider].short} · {node.category}
          </Badge>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto scrollbar-thin p-4">
        <Section title="General">
          <div className="space-y-1.5">
            <Label htmlFor="node-name">Name</Label>
            <Input id="node-name" value={node.name} onChange={(e) => updateNode(nodeId, { name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="node-region">Region</Label>
            <Input id="node-region" value={node.region} onChange={(e) => updateNode(nodeId, { region: e.target.value })} className="font-mono" />
          </div>
          <Row label="High availability">
            <Select value={node.haMode} onValueChange={(v) => updateNode(nodeId, { haMode: v as HaMode })}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single (no failover)</SelectItem>
                <SelectItem value="multi-az">Multi-AZ</SelectItem>
                <SelectItem value="multi-region">Multi-region</SelectItem>
                <SelectItem value="global">Global</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </Section>

        <Separator />

        <Section title="Scaling">
          <Row label="Mode">
            <Select value={node.scaling.mode} onValueChange={(v) => updateNode(nodeId, { scaling: { ...node.scaling, mode: v as "fixed" | "auto" } })}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="auto">Auto-scale</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Min</Label>
              <Input
                type="number"
                value={node.scaling.min}
                onChange={(e) => updateNode(nodeId, { scaling: { ...node.scaling, min: +e.target.value } })}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>Max</Label>
              <Input
                type="number"
                value={node.scaling.max}
                onChange={(e) => updateNode(nodeId, { scaling: { ...node.scaling, max: +e.target.value } })}
                className="h-8"
              />
            </div>
          </div>
        </Section>

        <Separator />

        <Section title="Security">
          <SecRow label="Encryption at rest" checked={node.security.encryptionAtRest} onChange={(v) => updateSecurity(nodeId, { encryptionAtRest: v })} />
          <SecRow label="Encryption in transit" checked={node.security.encryptionInTransit} onChange={(v) => updateSecurity(nodeId, { encryptionInTransit: v })} />
          <SecRow label="Public access" checked={node.security.publicAccess} onChange={(v) => updateSecurity(nodeId, { publicAccess: v })} warn />
          <SecRow label="Authentication required" checked={node.security.authRequired} onChange={(v) => updateSecurity(nodeId, { authRequired: v })} />
          <SecRow label="mTLS / workload identity" checked={node.security.mtls} onChange={(v) => updateSecurity(nodeId, { mtls: v })} />
          {(node.tier === "edge" || node.tier === "ingress") && (
            <SecRow label="WAF enabled" checked={!!node.security.wafEnabled} onChange={(v) => updateSecurity(nodeId, { wafEnabled: v })} />
          )}
        </Section>

        <Separator />

        <Section title="Cost">
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-semibold">{formatCurrency(node.costHint.monthly)}</span>
              <span className="text-[10px] text-muted-foreground">/mo · ±{Math.round(node.costHint.confidence * 100)}%</span>
            </div>
            <div className="mt-1.5 space-y-0.5">
              {node.costHint.drivers?.map((d) => (
                <div key={d} className="text-[11px] text-muted-foreground">• {d}</div>
              ))}
            </div>
          </div>
        </Section>
      </div>

      <div className="border-t border-border p-3">
        <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeNode(nodeId)}>
          <Trash2 className="size-4" /> Delete node
        </Button>
      </div>
    </div>
  );
}

function SecRow({ label, checked, onChange, warn }: { label: string; checked: boolean; onChange: (v: boolean) => void; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-xs">
        {warn && checked && <AlertTriangle className="size-3 text-warning" />}
        {!warn && checked && <ShieldCheck className="size-3 text-success" />}
        {label}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function EdgeProps({ edgeId }: { edgeId: string }) {
  const edge = useStudio((s) => s.graph.edges.find((e) => e.id === edgeId))!;
  const nodes = useStudio((s) => s.graph.nodes);
  const updateEdge = useStudio((s) => s.updateEdge);
  const removeEdge = useStudio((s) => s.removeEdge);
  const src = nodes.find((n) => n.id === edge.source);
  const tgt = nodes.find((n) => n.id === edge.target);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <GitFork className="size-3.5" /> Connection
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="truncate font-medium">{src?.name}</span>
          <ArrowLeftRight className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{tgt?.name}</span>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto scrollbar-thin p-4">
        <Section title="Connection type">
          <Row label="Kind">
            <Select value={edge.kind} onValueChange={(v) => updateEdge(edgeId, { kind: v as EdgeKind })}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="network">Network</SelectItem>
                <SelectItem value="data">Data</SelectItem>
                <SelectItem value="control">Control</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <div className="space-y-1.5">
            <Label>Protocol</Label>
            <Input value={edge.protocol ?? ""} onChange={(e) => updateEdge(edgeId, { protocol: e.target.value })} className="font-mono" />
          </div>
        </Section>

        <Separator />

        <Section title="Flags">
          <SecRow label="Latency-critical" checked={edge.latencyCritical} onChange={(v) => updateEdge(edgeId, { latencyCritical: v })} />
          <SecRow label="Carries sensitive data" checked={edge.sensitiveData} onChange={(v) => updateEdge(edgeId, { sensitiveData: v })} warn />
        </Section>
      </div>

      <div className="space-y-2 border-t border-border p-3">
        <Button variant="outline" className="w-full" onClick={() => updateEdge(edgeId, { source: edge.target, target: edge.source })}>
          <ArrowLeftRight className="size-4" /> Reverse direction
        </Button>
        <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeEdge(edgeId)}>
          <Trash2 className="size-4" /> Delete connection
        </Button>
      </div>
    </div>
  );
}

function GraphOverview() {
  const graph = useStudio((s) => s.graph);
  const cost = useCostSummary();
  const validation = useValidation();
  const providers = [...new Set(graph.nodes.map((n) => n.provider))];

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <div className="grid size-12 place-items-center rounded-xl bg-muted">
        <Boxes className="size-6 text-muted-foreground" />
      </div>
      <h3 className="mt-3 text-sm font-semibold">Nothing selected</h3>
      <p className="mt-1 text-xs text-muted-foreground">Select a node or connection to edit its properties.</p>

      <div className="mt-6 grid w-full grid-cols-2 gap-2 text-left">
        <Stat label="Resources" value={String(graph.nodes.length)} />
        <Stat label="Connections" value={String(graph.edges.length)} />
        <Stat label="Monthly est." value={formatCurrency(cost.total, { compact: true })} />
        <Stat label="Issues" value={String(validation.issues.length)} tone={validation.errorCount > 0 ? "danger" : "default"} />
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {providers.map((p) => (
          <Badge key={p} variant="secondary" className="text-[10px]">
            {PROVIDER_META[p].short}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={tone === "danger" ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>{value}</div>
    </div>
  );
}
