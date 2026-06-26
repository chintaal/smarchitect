import type {
  CloudProvider,
  HaMode,
  ScalingSettings,
  SecuritySettings,
  ServiceCategory,
  Tier,
} from "./types";

/**
 * Service catalog — the taxonomy of cloud resources that can be dropped on the
 * canvas. We reuse a provider-agnostic category/tier model (inspired by the
 * @cloud-diagrams/core taxonomy) and render custom nodes with clean glyphs.
 */
export interface CatalogService {
  key: string; // e.g. "aws.alb"
  provider: CloudProvider;
  label: string; // short display name
  fullName: string;
  category: ServiceCategory;
  tier: Tier;
  /** glyph key resolved by <ServiceIcon/> */
  icon: string;
  /** baseline monthly cost in USD for default config */
  baseCost: number;
  /** services that are valid downstream targets (by key) — drives validation */
  description: string;
  defaultHa?: HaMode;
  defaultMetadata?: Record<string, string | number | boolean>;
  security?: Partial<SecuritySettings>;
  scaling?: Partial<ScalingSettings>;
}

export const CATEGORY_META: Record<
  ServiceCategory,
  { label: string; accent: string; from: string; to: string }
> = {
  edge: { label: "Edge & CDN", accent: "violet", from: "#8B5CF6", to: "#6D28D9" },
  network: { label: "Networking", accent: "cyan", from: "#22D3EE", to: "#0891B2" },
  compute: { label: "Compute", accent: "blue", from: "#3D8BFF", to: "#1D4ED8" },
  data: { label: "Databases", accent: "emerald", from: "#34D399", to: "#059669" },
  storage: { label: "Storage", accent: "amber", from: "#FBBF24", to: "#D97706" },
  messaging: { label: "Messaging", accent: "rose", from: "#FB7185", to: "#E11D48" },
  security: { label: "Security & Identity", accent: "red", from: "#F87171", to: "#DC2626" },
  observability: { label: "Observability", accent: "indigo", from: "#818CF8", to: "#4F46E5" },
  ai: { label: "AI & ML", accent: "fuchsia", from: "#E879F9", to: "#C026D3" },
};

export const PROVIDER_META: Record<
  CloudProvider,
  { label: string; color: string; short: string }
> = {
  aws: { label: "Amazon Web Services", color: "var(--aws)", short: "AWS" },
  azure: { label: "Microsoft Azure", color: "var(--azure)", short: "Azure" },
  gcp: { label: "Google Cloud", color: "var(--gcp)", short: "GCP" },
  k8s: { label: "Kubernetes", color: "var(--k8s)", short: "K8s" },
  onprem: { label: "On-premises", color: "var(--muted-foreground)", short: "On-prem" },
};

const C = (
  key: string,
  provider: CloudProvider,
  label: string,
  fullName: string,
  category: ServiceCategory,
  tier: Tier,
  icon: string,
  baseCost: number,
  description: string,
  extra: Partial<CatalogService> = {},
): CatalogService => ({
  key,
  provider,
  label,
  fullName,
  category,
  tier,
  icon,
  baseCost,
  description,
  ...extra,
});

export const CATALOG: CatalogService[] = [
  // ---- AWS ----
  C("aws.cloudfront", "aws", "CloudFront", "Amazon CloudFront", "edge", "edge", "cdn", 35, "Global CDN with edge caching and TLS termination.", { defaultHa: "global", security: { encryptionInTransit: true, publicAccess: true, wafEnabled: false } }),
  C("aws.route53", "aws", "Route 53", "Amazon Route 53", "network", "edge", "dns", 5, "Scalable DNS and traffic routing.", { defaultHa: "global" }),
  C("aws.alb", "aws", "ALB", "Application Load Balancer", "network", "ingress", "loadbalancer", 22, "Layer-7 load balancer for HTTP/S traffic.", { defaultHa: "multi-az", security: { encryptionInTransit: true, publicAccess: true } }),
  C("aws.apigw", "aws", "API Gateway", "Amazon API Gateway", "network", "ingress", "apigateway", 30, "Managed API front door with throttling + auth.", { security: { authRequired: true, encryptionInTransit: true, publicAccess: true } }),
  C("aws.ec2", "aws", "EC2", "Amazon EC2", "compute", "compute", "server", 70, "Elastic virtual compute instances.", { scaling: { mode: "auto", min: 2, max: 8 } }),
  C("aws.ecs", "aws", "ECS Fargate", "Amazon ECS (Fargate)", "compute", "compute", "container", 90, "Serverless containers on Fargate.", { scaling: { mode: "auto", min: 2, max: 12 } }),
  C("aws.lambda", "aws", "Lambda", "AWS Lambda", "compute", "compute", "function", 18, "Event-driven serverless functions.", { scaling: { mode: "auto", min: 0, max: 1000 } }),
  C("aws.eks", "aws", "EKS", "Amazon EKS", "compute", "compute", "kubernetes", 150, "Managed Kubernetes control plane.", { scaling: { mode: "auto", min: 3, max: 20 } }),
  C("aws.rds", "aws", "RDS", "Amazon RDS (PostgreSQL)", "data", "data", "database", 140, "Managed relational database.", { defaultHa: "multi-az", security: { encryptionAtRest: true, encryptionInTransit: true, privateNetworking: true }, defaultMetadata: { engine: "postgres", instance: "db.r6g.large" } }),
  C("aws.dynamodb", "aws", "DynamoDB", "Amazon DynamoDB", "data", "data", "nosql", 45, "Serverless key-value & document database.", { defaultHa: "multi-region", security: { encryptionAtRest: true } }),
  C("aws.elasticache", "aws", "ElastiCache", "Amazon ElastiCache (Redis)", "data", "data", "cache", 55, "In-memory Redis/Memcached cache.", { defaultHa: "multi-az", defaultMetadata: { engine: "redis" } }),
  C("aws.s3", "aws", "S3", "Amazon S3", "storage", "data", "objectstore", 25, "Object storage with lifecycle + versioning.", { defaultHa: "multi-region", security: { encryptionAtRest: true } }),
  C("aws.sqs", "aws", "SQS", "Amazon SQS", "messaging", "integration", "queue", 8, "Managed message queue.", {}),
  C("aws.sns", "aws", "SNS", "Amazon SNS", "messaging", "integration", "topic", 6, "Pub/sub notifications + fanout.", {}),
  C("aws.kinesis", "aws", "Kinesis", "Amazon Kinesis", "messaging", "integration", "stream", 40, "Real-time data streaming.", {}),
  C("aws.waf", "aws", "WAF", "AWS WAF", "security", "security", "waf", 20, "Web application firewall rules.", {}),
  C("aws.cognito", "aws", "Cognito", "Amazon Cognito", "security", "security", "identity", 15, "User identity, tokens, and federation.", { security: { authRequired: true } }),
  C("aws.secrets", "aws", "Secrets Mgr", "AWS Secrets Manager", "security", "security", "secret", 10, "Encrypted secret storage + rotation.", { security: { encryptionAtRest: true } }),
  C("aws.cloudwatch", "aws", "CloudWatch", "Amazon CloudWatch", "observability", "observability", "metrics", 18, "Metrics, logs, and alarms.", {}),

  // ---- Azure ----
  C("azure.frontdoor", "azure", "Front Door", "Azure Front Door", "edge", "edge", "cdn", 38, "Global edge CDN + WAF + routing.", { defaultHa: "global" }),
  C("azure.appgw", "azure", "App Gateway", "Azure Application Gateway", "network", "ingress", "loadbalancer", 25, "Layer-7 load balancing with WAF.", { defaultHa: "multi-az" }),
  C("azure.aks", "azure", "AKS", "Azure Kubernetes Service", "compute", "compute", "kubernetes", 145, "Managed Kubernetes.", { scaling: { mode: "auto", min: 3, max: 20 } }),
  C("azure.functions", "azure", "Functions", "Azure Functions", "compute", "compute", "function", 16, "Serverless event functions.", { scaling: { mode: "auto", min: 0, max: 800 } }),
  C("azure.appservice", "azure", "App Service", "Azure App Service", "compute", "compute", "server", 75, "Managed web app hosting.", { scaling: { mode: "auto", min: 2, max: 10 } }),
  C("azure.sql", "azure", "Azure SQL", "Azure SQL Database", "data", "data", "database", 135, "Managed SQL database.", { defaultHa: "multi-az", security: { encryptionAtRest: true } }),
  C("azure.cosmos", "azure", "Cosmos DB", "Azure Cosmos DB", "data", "data", "nosql", 60, "Globally distributed multi-model DB.", { defaultHa: "multi-region", security: { encryptionAtRest: true } }),
  C("azure.blob", "azure", "Blob Storage", "Azure Blob Storage", "storage", "data", "objectstore", 22, "Object/blob storage.", { security: { encryptionAtRest: true } }),
  C("azure.servicebus", "azure", "Service Bus", "Azure Service Bus", "messaging", "integration", "queue", 12, "Enterprise message broker.", {}),

  // ---- GCP ----
  C("gcp.cloudcdn", "gcp", "Cloud CDN", "Google Cloud CDN", "edge", "edge", "cdn", 32, "Global content delivery.", { defaultHa: "global" }),
  C("gcp.lb", "gcp", "Cloud LB", "Cloud Load Balancing", "network", "ingress", "loadbalancer", 24, "Global anycast load balancer.", { defaultHa: "global" }),
  C("gcp.gke", "gcp", "GKE", "Google Kubernetes Engine", "compute", "compute", "kubernetes", 150, "Managed Kubernetes (Autopilot).", { scaling: { mode: "auto", min: 3, max: 20 } }),
  C("gcp.run", "gcp", "Cloud Run", "Google Cloud Run", "compute", "compute", "container", 28, "Serverless containers.", { scaling: { mode: "auto", min: 0, max: 100 } }),
  C("gcp.functions", "gcp", "Cloud Func", "Cloud Functions", "compute", "compute", "function", 14, "Event-driven functions.", { scaling: { mode: "auto", min: 0, max: 800 } }),
  C("gcp.cloudsql", "gcp", "Cloud SQL", "Cloud SQL (PostgreSQL)", "data", "data", "database", 130, "Managed relational DB.", { defaultHa: "multi-az", security: { encryptionAtRest: true } }),
  C("gcp.firestore", "gcp", "Firestore", "Cloud Firestore", "data", "data", "nosql", 38, "Serverless document DB.", { defaultHa: "multi-region", security: { encryptionAtRest: true } }),
  C("gcp.gcs", "gcp", "Cloud Storage", "Google Cloud Storage", "storage", "data", "objectstore", 21, "Object storage buckets.", { security: { encryptionAtRest: true } }),
  C("gcp.pubsub", "gcp", "Pub/Sub", "Cloud Pub/Sub", "messaging", "integration", "topic", 10, "Global messaging + streaming.", {}),

  // ---- Kubernetes / on-prem ----
  C("k8s.ingress", "k8s", "Ingress", "Kubernetes Ingress (NGINX)", "network", "ingress", "loadbalancer", 0, "Cluster ingress controller.", {}),
  C("k8s.deployment", "k8s", "Deployment", "Kubernetes Deployment", "compute", "compute", "container", 0, "Replicated pod workload.", { scaling: { mode: "auto", min: 3, max: 12 } }),
  C("k8s.statefulset", "k8s", "StatefulSet", "Kubernetes StatefulSet", "compute", "compute", "container", 0, "Stateful pod workload.", {}),
  C("onprem.postgres", "onprem", "PostgreSQL", "Self-managed PostgreSQL", "data", "data", "database", 0, "Self-hosted relational DB.", { security: { encryptionAtRest: true } }),
  C("onprem.redis", "onprem", "Redis", "Self-managed Redis", "data", "data", "cache", 0, "Self-hosted in-memory cache.", {}),
];

export const CATALOG_BY_KEY = new Map(CATALOG.map((s) => [s.key, s]));

export function getService(key: string): CatalogService | undefined {
  return CATALOG_BY_KEY.get(key);
}

export const CATALOG_BY_CATEGORY = CATALOG.reduce(
  (acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  },
  {} as Record<ServiceCategory, CatalogService[]>,
);

export const CATEGORY_ORDER: ServiceCategory[] = [
  "edge",
  "network",
  "compute",
  "data",
  "storage",
  "messaging",
  "security",
  "observability",
  "ai",
];

export const TIER_ORDER: Tier[] = [
  "edge",
  "ingress",
  "compute",
  "integration",
  "data",
  "security",
  "observability",
];
