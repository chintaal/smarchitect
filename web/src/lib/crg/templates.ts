import type { CloudResourceGraph } from "./types";
import { makeEdge, makeNode } from "./factory";
import { autoLayout } from "./layout";
import { recomputeCosts } from "./cost";

export interface ArchTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  variant: "aws" | "azure" | "gcp" | "private" | "multi";
  build: () => CloudResourceGraph;
}

function finalize(g: CloudResourceGraph): CloudResourceGraph {
  return recomputeCosts(autoLayout(g));
}

/* 1. Production 3-tier web app (intentionally has Zero Trust gaps to remediate) */
function threeTier(): CloudResourceGraph {
  const dns = makeNode("aws.route53", { x: 0, y: 0 });
  const cdn = makeNode("aws.cloudfront", { x: 0, y: 0 });
  const alb = makeNode("aws.alb", { x: 0, y: 0 }, { security: { ...defaultSec(), publicAccess: true, encryptionInTransit: true } });
  const ecs = makeNode("aws.ecs", { x: 0, y: 0 }, { name: "API Service" });
  const rds = makeNode("aws.rds", { x: 0, y: 0 }, { name: "Primary DB" });
  const cache = makeNode("aws.elasticache", { x: 0, y: 0 });
  const s3 = makeNode("aws.s3", { x: 0, y: 0 }, { name: "Assets Bucket" });

  return finalize({
    nodes: [dns, cdn, alb, ecs, rds, cache, s3],
    edges: [
      makeEdge(dns.id, cdn.id, { kind: "control", protocol: "DNS" }),
      makeEdge(cdn.id, alb.id),
      makeEdge(alb.id, ecs.id),
      makeEdge(ecs.id, rds.id, { kind: "data", protocol: "TCP/5432", sensitiveData: true, latencyCritical: true }),
      makeEdge(ecs.id, cache.id, { kind: "data", protocol: "TCP/6379", latencyCritical: true }),
      makeEdge(ecs.id, s3.id, { kind: "data", protocol: "HTTPS" }),
    ],
  });
}

/* 2. Serverless API */
function serverless(): CloudResourceGraph {
  const apigw = makeNode("aws.apigw", { x: 0, y: 0 }, { security: { ...defaultSec(), publicAccess: true, encryptionInTransit: true, authRequired: true } });
  const fn = makeNode("aws.lambda", { x: 0, y: 0 }, { name: "Orders Fn" });
  const fn2 = makeNode("aws.lambda", { x: 0, y: 0 }, { name: "Worker Fn" });
  const ddb = makeNode("aws.dynamodb", { x: 0, y: 0 }, { name: "Orders Table" });
  const sqs = makeNode("aws.sqs", { x: 0, y: 0 });
  const s3 = makeNode("aws.s3", { x: 0, y: 0 });
  const cw = makeNode("aws.cloudwatch", { x: 0, y: 0 });

  return finalize({
    nodes: [apigw, fn, fn2, ddb, sqs, s3, cw],
    edges: [
      makeEdge(apigw.id, fn.id),
      makeEdge(fn.id, ddb.id, { kind: "data", sensitiveData: true }),
      makeEdge(fn.id, sqs.id, { kind: "data" }),
      makeEdge(sqs.id, fn2.id),
      makeEdge(fn2.id, s3.id, { kind: "data" }),
      makeEdge(fn.id, cw.id, { kind: "control" }),
    ],
  });
}

/* 3. Kubernetes microservices */
function kubernetes(): CloudResourceGraph {
  const cdn = makeNode("aws.cloudfront", { x: 0, y: 0 });
  const alb = makeNode("aws.alb", { x: 0, y: 0 }, { security: { ...defaultSec(), publicAccess: true, encryptionInTransit: true, wafEnabled: true } });
  const eks = makeNode("aws.eks", { x: 0, y: 0 }, { name: "Service Mesh" });
  const rds = makeNode("aws.rds", { x: 0, y: 0 }, { name: "Orders DB", haMode: "multi-az" });
  const cache = makeNode("aws.elasticache", { x: 0, y: 0 });
  const kinesis = makeNode("aws.kinesis", { x: 0, y: 0 });
  const cw = makeNode("aws.cloudwatch", { x: 0, y: 0 });
  const secrets = makeNode("aws.secrets", { x: 0, y: 0 });

  return finalize({
    nodes: [cdn, alb, eks, rds, cache, kinesis, cw, secrets],
    edges: [
      makeEdge(cdn.id, alb.id),
      makeEdge(alb.id, eks.id),
      makeEdge(eks.id, rds.id, { kind: "data", sensitiveData: true }),
      makeEdge(eks.id, cache.id, { kind: "data" }),
      makeEdge(eks.id, kinesis.id, { kind: "data" }),
      makeEdge(eks.id, cw.id, { kind: "control" }),
      makeEdge(eks.id, secrets.id, { kind: "control" }),
    ],
  });
}

/* 4. Multi-cloud data platform */
function multiCloud(): CloudResourceGraph {
  const gw = makeNode("gcp.lb", { x: 0, y: 0 }, { security: { ...defaultSec(), publicAccess: true, encryptionInTransit: true } });
  const run = makeNode("gcp.run", { x: 0, y: 0 }, { name: "Ingest API" });
  const pubsub = makeNode("gcp.pubsub", { x: 0, y: 0 });
  const bq = makeNode("gcp.firestore", { x: 0, y: 0 }, { name: "Event Store" });
  const lambda = makeNode("aws.lambda", { x: 0, y: 0 }, { name: "Enrichment" });
  const s3 = makeNode("aws.s3", { x: 0, y: 0 }, { name: "Data Lake" });
  const azfn = makeNode("azure.functions", { x: 0, y: 0 }, { name: "Reporting" });
  const cosmos = makeNode("azure.cosmos", { x: 0, y: 0 });

  return finalize({
    nodes: [gw, run, pubsub, bq, lambda, s3, azfn, cosmos],
    edges: [
      makeEdge(gw.id, run.id),
      makeEdge(run.id, pubsub.id, { kind: "data" }),
      makeEdge(pubsub.id, bq.id, { kind: "data" }),
      makeEdge(pubsub.id, lambda.id, { kind: "data" }),
      makeEdge(lambda.id, s3.id, { kind: "data" }),
      makeEdge(s3.id, azfn.id, { kind: "data" }),
      makeEdge(azfn.id, cosmos.id, { kind: "data" }),
    ],
  });
}

function defaultSec() {
  return {
    encryptionAtRest: false,
    encryptionInTransit: false,
    publicAccess: false,
    authRequired: false,
    mtls: false,
    wafEnabled: false,
    privateNetworking: false,
  };
}

export const TEMPLATES: ArchTemplate[] = [
  {
    id: "three-tier",
    name: "Production Web App (3-tier)",
    description: "CDN → load balancer → containers → relational DB, cache and object storage. The classic, hardened starting point.",
    tags: ["AWS", "Containers", "Stateful"],
    variant: "aws",
    build: threeTier,
  },
  {
    id: "serverless",
    name: "Serverless Event API",
    description: "API Gateway, Lambda, DynamoDB and an async SQS worker. Scales to zero, pay-per-request.",
    tags: ["AWS", "Serverless", "Event-driven"],
    variant: "aws",
    build: serverless,
  },
  {
    id: "kubernetes",
    name: "Kubernetes Microservices",
    description: "EKS service mesh behind an ALB with WAF, multi-AZ database, streaming and centralized secrets.",
    tags: ["AWS", "Kubernetes", "Microservices"],
    variant: "aws",
    build: kubernetes,
  },
  {
    id: "multi-cloud",
    name: "Multi-Cloud Data Platform",
    description: "Ingest on GCP, enrich on AWS, report on Azure. One graph spanning three clouds.",
    tags: ["Multi-cloud", "Data", "Streaming"],
    variant: "multi",
    build: multiCloud,
  },
];

export function getTemplate(id: string): ArchTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
