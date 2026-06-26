"use client";

import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CONNECTIONS } from "@/lib/data/mock";
import { PROVIDER_META } from "@/lib/crg/catalog";
import { relativeTime, cn } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, RefreshCw, FileCode2, ShieldCheck, Upload, Dot } from "lucide-react";

const PROVIDERS = [
  { id: "aws", name: "Amazon Web Services", role: "arn:aws:iam::*:role/SmArchitectReadOnly", color: "var(--aws)" },
  { id: "azure", name: "Microsoft Azure", role: "Reader role · Service Principal", color: "var(--azure)" },
  { id: "gcp", name: "Google Cloud", role: "roles/viewer · Workload Identity", color: "var(--gcp)" },
] as const;

export default function ConnectionsPage() {
  return (
    <PageShell
      title="Connections"
      description="Read-only discovery across AWS, Azure & GCP — and Terraform state import"
      actions={
        <Button size="sm" variant="outline" onClick={() => toast.info("Connect flow", { description: "Least-privilege, read-only roles only — no write paths in the import plane." })}>
          <Plus className="size-4" /> Add connection
        </Button>
      }
    >
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <ShieldCheck className="size-3.5 text-primary" /> Least-privilege by design.
        </span>{" "}
        SmArchitect only ever requests read-only roles. There are no write paths in the import plane — discovery cannot mutate your accounts.
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {PROVIDERS.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: `hsl(${p.color})` }}>
                {PROVIDER_META[p.id].short}
              </span>
              <div className="text-sm font-semibold">{p.name}</div>
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">{p.role}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              onClick={() => toast.success(`Connecting ${PROVIDER_META[p.id].short}`, { description: "Generating a read-only role policy…" })}
            >
              Connect (read-only)
            </Button>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Connected accounts</h2>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Resources</th>
                  <th className="px-4 py-2.5 font-medium">Drift</th>
                  <th className="px-4 py-2.5 font-medium">Last sync</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {CONNECTIONS.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-6 place-items-center rounded text-[9px] font-bold text-white" style={{ background: `hsl(var(--${c.provider}))` }}>
                          {PROVIDER_META[c.provider].short}
                        </span>
                        <span className="font-medium">{c.name}</span>
                      </div>
                      <div className="mt-0.5 pl-8 font-mono text-[10px] text-muted-foreground">{c.scope}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.resources}</td>
                    <td className="px-4 py-3">
                      {c.drift > 0 ? <Badge variant="warning" className="text-[10px]">{c.drift} drifted</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{relativeTime(c.lastSynced)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toast.success(`Re-syncing ${c.name}`)}
                        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <RefreshCw className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold">Import Terraform state</h2>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-muted">
                <FileCode2 className="size-4 text-muted-foreground" />
              </div>
              <div className="text-sm font-medium">terraform.tfstate</div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Reconstruct the Cloud Resource Graph from existing HCL or state. Detects drift against your designed graph.
            </p>
            <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border py-6 text-center transition-colors hover:border-primary/40">
              <Upload className="size-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Drop a .tfstate file or click to browse</span>
              <input type="file" className="hidden" onChange={() => toast.success("Parsing state", { description: "Reconstructing the graph from 142 resources…" })} />
            </label>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "success" | "warning" | "destructive" | "muted"; label: string; pulse?: boolean }> = {
    connected: { variant: "success", label: "Connected" },
    syncing: { variant: "warning", label: "Syncing", pulse: true },
    error: { variant: "destructive", label: "Error" },
    disconnected: { variant: "muted", label: "Disconnected" },
  };
  const s = map[status] ?? map.disconnected;
  return (
    <Badge variant={s.variant} className="text-[10px]">
      <Dot className={cn("-mx-1 size-4", s.pulse && "animate-pulse")} /> {s.label}
    </Badge>
  );
}
