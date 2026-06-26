import type { Project } from "@/lib/crg/types";

export const PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Checkout Platform",
    description: "Multi-region commerce backend with PCI scope and async fulfilment.",
    createdAt: "2026-05-02T10:00:00Z",
    updatedAt: "2026-06-24T16:20:00Z",
    variant: "aws",
    monthlyEstimate: 4820,
    nodeCount: 14,
    complianceScore: 86,
    status: "active",
    tags: ["PCI DSS", "Multi-region", "Containers"],
  },
  {
    id: "p2",
    name: "Patient Records API",
    description: "HIPAA-aligned ingestion and FHIR API for clinical records.",
    createdAt: "2026-04-18T09:00:00Z",
    updatedAt: "2026-06-25T11:05:00Z",
    variant: "azure",
    monthlyEstimate: 2615,
    nodeCount: 11,
    complianceScore: 92,
    status: "active",
    tags: ["HIPAA", "Zero Trust", "Serverless"],
  },
  {
    id: "p3",
    name: "Telemetry Lake",
    description: "Multi-cloud event pipeline: ingest on GCP, enrich on AWS, report on Azure.",
    createdAt: "2026-03-30T14:00:00Z",
    updatedAt: "2026-06-20T08:42:00Z",
    variant: "multi",
    monthlyEstimate: 3970,
    nodeCount: 18,
    complianceScore: 74,
    status: "active",
    tags: ["Multi-cloud", "Streaming"],
  },
  {
    id: "p4",
    name: "Legacy VPC (imported)",
    description: "Read-only import of the prod-east AWS account. 3 drifted resources.",
    createdAt: "2026-06-10T14:00:00Z",
    updatedAt: "2026-06-26T07:10:00Z",
    variant: "aws",
    monthlyEstimate: 6240,
    nodeCount: 27,
    complianceScore: 61,
    status: "imported",
    tags: ["Imported", "Drift: 3"],
  },
  {
    id: "p5",
    name: "Internal Dev Platform",
    description: "Self-service Kubernetes platform for internal teams.",
    createdAt: "2026-06-15T14:00:00Z",
    updatedAt: "2026-06-22T13:30:00Z",
    variant: "gcp",
    monthlyEstimate: 1840,
    nodeCount: 9,
    complianceScore: 68,
    status: "draft",
    tags: ["GKE", "Internal"],
  },
];

export interface ModelEntry {
  id: string;
  provider: string;
  label: string;
  inputCost: number; // per 1M tokens
  outputCost: number;
  latency: "fast" | "balanced" | "frontier";
  role: string;
  enabled: boolean;
}

/** LiteLLM-routed model catalog (Settings + model selector). */
export const MODELS: ModelEntry[] = [
  { id: "claude-opus-4-8", provider: "Anthropic", label: "Claude Opus 4.8", inputCost: 5, outputCost: 25, latency: "frontier", role: "Architect · Security Critic", enabled: true },
  { id: "claude-sonnet-4-6", provider: "Anthropic", label: "Claude Sonnet 4.6", inputCost: 3, outputCost: 15, latency: "balanced", role: "Requirements · Compliance", enabled: true },
  { id: "claude-haiku-4-5", provider: "Anthropic", label: "Claude Haiku 4.5", inputCost: 0.8, outputCost: 4, latency: "fast", role: "Node labels · Cost math", enabled: true },
  { id: "gpt-4o", provider: "OpenAI", label: "GPT-4o", inputCost: 2.5, outputCost: 10, latency: "balanced", role: "Fallback", enabled: true },
  { id: "gemini-2.5-pro", provider: "Google", label: "Gemini 2.5 Pro", inputCost: 1.25, outputCost: 10, latency: "balanced", role: "Research", enabled: true },
  { id: "llama-3.3-70b", provider: "Ollama (self-host)", label: "Llama 3.3 70B", inputCost: 0, outputCost: 0, latency: "fast", role: "Local / private", enabled: false },
];

export interface CloudConnectionEntry {
  id: string;
  provider: "aws" | "azure" | "gcp";
  name: string;
  scope: string;
  status: "connected" | "syncing" | "error" | "disconnected";
  lastSynced: string;
  resources: number;
  drift: number;
}

export const CONNECTIONS: CloudConnectionEntry[] = [
  { id: "c1", provider: "aws", name: "prod-east (123456789012)", scope: "us-east-1, us-west-2", status: "connected", lastSynced: "2026-06-26T07:10:00Z", resources: 142, drift: 3 },
  { id: "c2", provider: "aws", name: "staging (210987654321)", scope: "us-east-1", status: "connected", lastSynced: "2026-06-26T06:40:00Z", resources: 68, drift: 0 },
  { id: "c3", provider: "azure", name: "Contoso-Prod", scope: "East US, West Europe", status: "syncing", lastSynced: "2026-06-26T07:30:00Z", resources: 91, drift: 1 },
  { id: "c4", provider: "gcp", name: "telemetry-prod", scope: "us-central1", status: "connected", lastSynced: "2026-06-25T22:00:00Z", resources: 54, drift: 0 },
];

export interface InventoryEntry {
  id: string;
  name: string;
  type: string;
  provider: "aws" | "azure" | "gcp";
  region: string;
  account: string;
  monthly: number;
  drift: "synced" | "added" | "removed" | "changed";
  tags: string[];
}

export const INVENTORY: InventoryEntry[] = [
  { id: "r1", name: "checkout-alb", type: "Application Load Balancer", provider: "aws", region: "us-east-1", account: "prod-east", monthly: 28, drift: "synced", tags: ["prod"] },
  { id: "r2", name: "orders-db-primary", type: "RDS PostgreSQL", provider: "aws", region: "us-east-1", account: "prod-east", monthly: 340, drift: "changed", tags: ["prod", "pci"] },
  { id: "r3", name: "sessions-redis", type: "ElastiCache Redis", provider: "aws", region: "us-east-1", account: "prod-east", monthly: 88, drift: "synced", tags: ["prod"] },
  { id: "r4", name: "legacy-ec2-bastion", type: "EC2 t3.medium", provider: "aws", region: "us-east-1", account: "prod-east", monthly: 30, drift: "added", tags: ["unmanaged"] },
  { id: "r5", name: "fulfilment-queue", type: "SQS", provider: "aws", region: "us-east-1", account: "prod-east", monthly: 12, drift: "synced", tags: ["prod"] },
  { id: "r6", name: "old-snapshots-bucket", type: "S3 Bucket", provider: "aws", region: "us-west-2", account: "prod-east", monthly: 210, drift: "removed", tags: ["orphaned", "cost-anomaly"] },
  { id: "r7", name: "fhir-functions", type: "Azure Functions", provider: "azure", region: "East US", account: "Contoso-Prod", monthly: 64, drift: "synced", tags: ["hipaa"] },
  { id: "r8", name: "events-pubsub", type: "Cloud Pub/Sub", provider: "gcp", region: "us-central1", account: "telemetry-prod", monthly: 41, drift: "synced", tags: ["prod"] },
];

export interface SpendEntry {
  date: string;
  amount: number;
}

export const LLM_SPEND_30D: SpendEntry[] = Array.from({ length: 30 }, (_, i) => {
  const base = 6 + Math.sin(i / 3) * 3 + (i > 22 ? 5 : 0);
  return {
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    amount: Math.max(1, Math.round((base + Math.random() * 2) * 100) / 100),
  };
});

export const LLM_SPEND_BY_TASK = [
  { task: "Architect", amount: 64.2, model: "Claude Opus 4.8" },
  { task: "Security Critic", amount: 38.9, model: "Claude Opus 4.8" },
  { task: "Requirements", amount: 21.4, model: "Claude Sonnet 4.6" },
  { task: "Compliance", amount: 18.7, model: "Claude Sonnet 4.6" },
  { task: "Cost & Sizing", amount: 6.1, model: "Claude Haiku 4.5" },
  { task: "Node labels", amount: 2.3, model: "Claude Haiku 4.5" },
];

export interface ActivityEntry {
  id: string;
  who: string;
  action: string;
  target: string;
  at: string;
  kind: "edit" | "generate" | "compliance" | "import" | "deploy";
}

export const ACTIVITY: ActivityEntry[] = [
  { id: "a1", who: "You", action: "applied Zero Trust remediation to", target: "Checkout Platform", at: "2026-06-26T07:40:00Z", kind: "compliance" },
  { id: "a2", who: "Architect Agent", action: "generated 14 resources for", target: "Checkout Platform", at: "2026-06-26T07:20:00Z", kind: "generate" },
  { id: "a3", who: "You", action: "imported 142 resources from", target: "prod-east", at: "2026-06-26T07:10:00Z", kind: "import" },
  { id: "a4", who: "You", action: "exported Terraform for", target: "Patient Records API", at: "2026-06-25T18:30:00Z", kind: "deploy" },
  { id: "a5", who: "Security Critic", action: "flagged 2 high-severity findings in", target: "Telemetry Lake", at: "2026-06-25T15:02:00Z", kind: "compliance" },
];
