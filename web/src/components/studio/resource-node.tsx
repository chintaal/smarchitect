"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ServiceIcon } from "@/components/brand/service-icon";
import { getService } from "@/lib/crg/catalog";
import type { ResourceNode as ResourceNodeData } from "@/lib/crg/types";
import type { NodeComplianceStatus } from "@/lib/crg/compliance/shared";
import { cn } from "@/lib/utils";
import { AlertTriangle, Globe, Lock, Layers, ShieldCheck, ShieldX } from "lucide-react";

export interface RFNodeData {
  node: ResourceNodeData;
  lensStatus?: NodeComplianceStatus;
  hasError?: boolean;
  hasWarning?: boolean;
  [key: string]: unknown;
}

function ResourceNodeInner({ data, selected }: NodeProps) {
  const d = data as RFNodeData;
  const n = d.node;
  const svc = getService(n.serviceType);
  const lens = d.lensStatus;

  const ringClass =
    lens === "fail"
      ? "ring-2 ring-destructive shadow-[0_0_0_4px_hsl(var(--destructive)/0.12)]"
      : lens === "pass"
        ? "ring-2 ring-success/70"
        : lens === "partial"
          ? "ring-2 ring-warning/80"
          : selected
            ? "ring-2 ring-primary shadow-glow-sm"
            : d.hasError
              ? "ring-2 ring-destructive/80"
              : "ring-1 ring-border hover:ring-border/80";

  return (
    <div
      className={cn(
        "group relative w-[208px] rounded-xl bg-card/95 backdrop-blur transition-all duration-150",
        "shadow-node hover:shadow-node-hover",
        ringClass,
      )}
    >
      <Handle type="target" position={Position.Left} className="!left-[-5px]" />
      <Handle type="source" position={Position.Right} className="!right-[-5px]" />

      <div className="flex items-center gap-3 p-3">
        <ServiceIcon serviceType={n.serviceType} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold leading-tight">{n.name}</span>
            {(d.hasError || d.hasWarning) && (
              <AlertTriangle
                className={cn("size-3 shrink-0", d.hasError ? "text-destructive" : "text-warning")}
              />
            )}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{svc?.fullName ?? n.serviceType}</div>
        </div>
      </div>

      <div className="flex items-center gap-1 border-t border-border/60 px-3 py-1.5">
        <span className="font-mono text-[10px] text-muted-foreground">{n.region}</span>
        <div className="ml-auto flex items-center gap-1">
          {n.haMode !== "single" && (
            <Pill title={`${n.haMode} high availability`}>
              <Layers className="size-2.5" /> {n.haMode === "multi-az" ? "HA" : n.haMode === "global" ? "GBL" : "MR"}
            </Pill>
          )}
          {n.security.publicAccess ? (
            <Pill title="Publicly accessible" tone="warn">
              <Globe className="size-2.5" />
            </Pill>
          ) : (
            <Pill title="Private">
              <Lock className="size-2.5" />
            </Pill>
          )}
          {n.security.encryptionAtRest || n.security.encryptionInTransit ? (
            <Pill title="Encrypted" tone="ok">
              <ShieldCheck className="size-2.5" />
            </Pill>
          ) : (n.category === "data" || n.category === "storage") ? (
            <Pill title="Not encrypted" tone="warn">
              <ShieldX className="size-2.5" />
            </Pill>
          ) : null}
        </div>
      </div>

      {n.driftStatus && n.driftStatus !== "synced" && (
        <span
          className={cn(
            "absolute -right-1.5 -top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase",
            n.driftStatus === "added" && "bg-success text-success-foreground",
            n.driftStatus === "removed" && "bg-destructive text-destructive-foreground",
            n.driftStatus === "changed" && "bg-warning text-warning-foreground",
          )}
        >
          {n.driftStatus}
        </span>
      )}
    </div>
  );
}

function Pill({
  children,
  title,
  tone = "muted",
}: {
  children: React.ReactNode;
  title: string;
  tone?: "muted" | "ok" | "warn";
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "ok" && "bg-success/15 text-success",
        tone === "warn" && "bg-warning/15 text-warning",
      )}
    >
      {children}
    </span>
  );
}

export const ResourceNode = memo(ResourceNodeInner);
