/**
 * Cloud Resource Graph (CRG) — the provider-agnostic, versioned directed graph
 * that is the single source of truth for everything in SmArchitect.
 *
 * One graph, four directions: GENERATE (agents) · IMPORT (live cloud + TF state)
 *                             EXPORT (IaC) · EDIT (canvas + talk-to-edit)
 */

export type CloudProvider = "aws" | "azure" | "gcp" | "k8s" | "onprem";

/** Logical service categories — used for the palette grouping + auto-layout tiers. */
export type ServiceCategory =
  | "edge"
  | "network"
  | "compute"
  | "data"
  | "storage"
  | "messaging"
  | "security"
  | "observability"
  | "ai";

/** Architectural tier — drives tier-based auto-layout (left → right). */
export type Tier =
  | "edge"
  | "ingress"
  | "compute"
  | "data"
  | "integration"
  | "security"
  | "observability";

export type HaMode = "single" | "multi-az" | "multi-region" | "global";

export type EdgeKind = "network" | "data" | "control";

export interface SecuritySettings {
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  publicAccess: boolean;
  /** Identity/auth posture relevant to Zero Trust evaluation. */
  authRequired: boolean;
  /** mTLS / workload identity (SPIFFE) — Zero Trust signal. */
  mtls: boolean;
  wafEnabled?: boolean;
  privateNetworking?: boolean;
}

export interface ScalingSettings {
  mode: "fixed" | "auto";
  min: number;
  max: number;
}

export interface CostHint {
  /** Estimated monthly USD for this node at its current configuration. */
  monthly: number;
  /** Confidence band as a +/- fraction (0.2 == ±20%). */
  confidence: number;
  drivers?: string[];
}

/** A node = a cloud resource. */
export interface ResourceNode {
  id: string;
  name: string;
  provider: CloudProvider;
  /** Catalog service key, e.g. "aws.alb", "aws.rds". */
  serviceType: string;
  category: ServiceCategory;
  tier: Tier;
  region: string;
  haMode: HaMode;
  security: SecuritySettings;
  scaling: ScalingSettings;
  costHint: CostHint;
  complianceTags: string[];
  /** Free-form metadata (instance size, engine, etc.). */
  metadata: Record<string, string | number | boolean>;
  /** Canvas position. */
  position: { x: number; y: number };
  /** Set by import plane when this node mirrors a live resource. */
  driftStatus?: "synced" | "added" | "removed" | "changed";
  nativeId?: string;
}

/** An edge = a connection (network / data / control). */
export interface ResourceEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  protocol?: string;
  latencyCritical: boolean;
  sensitiveData: boolean;
  label?: string;
}

export interface CloudResourceGraph {
  nodes: ResourceNode[];
  edges: ResourceEdge[];
}

/* --------------------------------------------------------------------------
 * Project / Architecture / lifecycle entities (Section 8 of the plan).
 * ----------------------------------------------------------------------- */

export type ArchitectureVariant = "aws" | "azure" | "gcp" | "private" | "multi";

export interface PatchHistoryEntry {
  id: string;
  intent: string;
  summary: string;
  appliedAt: string;
  appliedBy: string;
  /** Number of node/edge mutations in this patch. */
  changeCount: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  variant: ArchitectureVariant;
  monthlyEstimate: number;
  nodeCount: number;
  complianceScore: number; // 0..100
  status: "draft" | "active" | "imported";
  tags: string[];
}
