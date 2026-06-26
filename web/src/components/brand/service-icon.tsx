import {
  Activity,
  Box,
  Boxes,
  Container,
  Database,
  DatabaseZap,
  Fingerprint,
  Globe,
  Inbox,
  KeyRound,
  Megaphone,
  Network,
  Server,
  Shield,
  Table2,
  Waves,
  Waypoints,
  Webhook,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_META, getService, PROVIDER_META } from "@/lib/crg/catalog";
import type { CloudProvider, ServiceCategory } from "@/lib/crg/types";
import { cn } from "@/lib/utils";

const GLYPHS: Record<string, LucideIcon> = {
  cdn: Globe,
  dns: Waypoints,
  loadbalancer: Network,
  apigateway: Webhook,
  server: Server,
  container: Container,
  function: Zap,
  kubernetes: Boxes,
  database: Database,
  nosql: Table2,
  cache: DatabaseZap,
  objectstore: Box,
  queue: Inbox,
  topic: Megaphone,
  stream: Waves,
  waf: Shield,
  identity: Fingerprint,
  secret: KeyRound,
  metrics: Activity,
};

export function ServiceIcon({
  serviceType,
  icon,
  category,
  provider,
  size = 36,
  className,
}: {
  serviceType?: string;
  icon?: string;
  category?: ServiceCategory;
  provider?: CloudProvider;
  size?: number;
  className?: string;
}) {
  const svc = serviceType ? getService(serviceType) : undefined;
  const iconKey = icon ?? svc?.icon ?? "server";
  const cat = category ?? svc?.category ?? "compute";
  const prov = provider ?? svc?.provider;
  const Glyph = GLYPHS[iconKey] ?? Server;
  const meta = CATEGORY_META[cat];

  return (
    <div
      className={cn("relative grid place-items-center rounded-lg shadow-node ring-1 ring-white/10", className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${meta.from}, ${meta.to})`,
      }}
    >
      <Glyph size={size * 0.5} strokeWidth={2} className="text-white drop-shadow" />
      {prov && (
        <span
          className="absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-[4px] text-[7px] font-bold text-white ring-1 ring-background"
          style={{ background: `hsl(${PROVIDER_META[prov].color})` }}
          title={PROVIDER_META[prov].label}
        >
          {prov === "aws" ? "a" : prov === "azure" ? "Az" : prov === "gcp" ? "G" : prov === "k8s" ? "K" : "○"}
        </span>
      )}
    </div>
  );
}
