import { nanoid } from "nanoid";
import { getService, type CatalogService } from "./catalog";
import type { CostHint, ResourceEdge, ResourceNode, SecuritySettings } from "./types";

const DEFAULT_SECURITY: SecuritySettings = {
  encryptionAtRest: false,
  encryptionInTransit: false,
  publicAccess: false,
  authRequired: false,
  mtls: false,
  wafEnabled: false,
  privateNetworking: false,
};

export function makeNode(
  serviceKey: string,
  position: { x: number; y: number },
  overrides: Partial<ResourceNode> = {},
): ResourceNode {
  const svc = getService(serviceKey);
  if (!svc) throw new Error(`Unknown service: ${serviceKey}`);

  const security: SecuritySettings = { ...DEFAULT_SECURITY, ...svc.security };
  const costHint: CostHint = {
    monthly: svc.baseCost,
    confidence: 0.2,
    drivers: [`${svc.label} baseline`],
  };

  return {
    id: nanoid(8),
    name: defaultName(svc),
    provider: svc.provider,
    serviceType: svc.key,
    category: svc.category,
    tier: svc.tier,
    region: defaultRegion(svc.provider),
    haMode: svc.defaultHa ?? "single",
    security,
    scaling: { mode: "fixed", min: 1, max: 1, ...svc.scaling },
    costHint,
    complianceTags: [],
    metadata: { ...svc.defaultMetadata },
    position,
    ...overrides,
  };
}

export function makeEdge(
  source: string,
  target: string,
  overrides: Partial<ResourceEdge> = {},
): ResourceEdge {
  return {
    id: nanoid(8),
    source,
    target,
    kind: "network",
    protocol: "HTTPS",
    latencyCritical: false,
    sensitiveData: false,
    ...overrides,
  };
}

function defaultName(svc: CatalogService): string {
  return svc.label;
}

function defaultRegion(provider: string): string {
  switch (provider) {
    case "aws":
      return "us-east-1";
    case "azure":
      return "eastus";
    case "gcp":
      return "us-central1";
    default:
      return "primary";
  }
}
