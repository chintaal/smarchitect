import type { CloudResourceGraph } from "./types";
import { getTemplate } from "./templates";

export interface RequirementsSpec {
  workloads: string[];
  nfrs: string[];
  complianceTags: string[];
  regions: string[];
  budgetBand: string;
  clarifyingQuestions: string[];
}

export interface GenerateResult {
  projectName: string;
  spec: RequirementsSpec;
  graph: CloudResourceGraph;
  rationale: string;
}

/**
 * Requirements Analyst + Architect, deterministic edition. Maps a free-text
 * brief to a structured spec and a starting graph. The /api/generate route can
 * swap this for a LangGraph + LiteLLM pipeline; this keeps generation working
 * with no API key.
 */
export function generateFromPrompt(prompt: string): GenerateResult {
  const p = prompt.toLowerCase();

  let templateId = "three-tier";
  if (/\b(serverless|lambda|event[- ]driven|functions?)\b/.test(p)) templateId = "serverless";
  if (/\b(kubernetes|k8s|microservices?|service mesh|eks|containers?)\b/.test(p)) templateId = "kubernetes";
  if (/\b(multi[- ]cloud|data (lake|pipeline|platform)|streaming|analytics|telemetry)\b/.test(p)) templateId = "multi-cloud";

  const tpl = getTemplate(templateId)!;
  const graph = tpl.build();

  const complianceTags: string[] = [];
  if (/\b(hipaa|phi|health|clinical|patient)\b/.test(p)) complianceTags.push("HIPAA");
  if (/\b(pci|payment|card|checkout|commerce)\b/.test(p)) complianceTags.push("PCI DSS");
  if (/\b(soc ?2|soc2|audit)\b/.test(p)) complianceTags.push("SOC 2");
  if (/\b(zero ?trust|ztna|least privilege)\b/.test(p) || complianceTags.length) complianceTags.push("Zero Trust");

  const regions: string[] = [];
  if (/\b(eu|europe|gdpr)\b/.test(p)) regions.push("eu-west-1");
  if (/\b(multi[- ]region|global|worldwide|ha|disaster recovery|dr)\b/.test(p)) regions.push("us-east-1", "us-west-2");
  if (regions.length === 0) regions.push("us-east-1");

  const workloads = inferWorkloads(p);
  const nfrs = inferNfrs(p);

  const budgetBand = /\b(cheap|low cost|budget|minimal)\b/.test(p)
    ? "Cost-optimized"
    : /\b(scale|high traffic|millions|enterprise)\b/.test(p)
      ? "Performance-first"
      : "Balanced";

  const projectName = guessName(prompt);

  return {
    projectName,
    spec: {
      workloads,
      nfrs,
      complianceTags: [...new Set(complianceTags)],
      regions,
      budgetBand,
      clarifyingQuestions: buildQuestions(p, complianceTags),
    },
    graph,
    rationale: `Selected the “${tpl.name}” pattern based on your brief, scaffolded ${graph.nodes.length} resources across ${
      new Set(graph.nodes.map((n) => n.tier)).size
    } tiers, and wired the data path. Toggle the Zero Trust lens to see where it needs hardening.`,
  };
}

function inferWorkloads(p: string): string[] {
  const out = new Set<string>();
  if (/\bapi\b/.test(p)) out.add("HTTP API");
  if (/\b(web|frontend|site|app)\b/.test(p)) out.add("Web frontend");
  if (/\b(worker|background|async|queue|job)\b/.test(p)) out.add("Async worker");
  if (/\b(stream|kafka|kinesis|ingest|events?)\b/.test(p)) out.add("Streaming ingestion");
  if (/\b(report|analytics|dashboard|bi)\b/.test(p)) out.add("Analytics / reporting");
  if (out.size === 0) out.add("Stateless service").add("Relational datastore");
  return [...out];
}

function inferNfrs(p: string): string[] {
  const out: string[] = [];
  if (/\b(ha|highly available|uptime|99\.9|resilient|failover)\b/.test(p)) out.push("High availability (multi-AZ)");
  if (/\b(scale|autoscal|elastic|traffic)\b/.test(p)) out.push("Horizontal autoscaling");
  if (/\b(low latency|fast|realtime|real-time)\b/.test(p)) out.push("Low latency (<100ms)");
  if (/\b(secure|encrypt|compliance|sensitive)\b/.test(p)) out.push("Encryption everywhere");
  if (out.length === 0) out.push("Standard availability", "Pay-as-you-go cost profile");
  return out;
}

function buildQuestions(p: string, tags: string[]): string[] {
  const q: string[] = [];
  if (!/\b(region|global|multi-region|eu|us)\b/.test(p)) q.push("Which region(s) should this run in, and do you need multi-region failover?");
  if (!/\b(traffic|users|rps|requests|scale)\b/.test(p)) q.push("What's the expected peak traffic (requests/sec or daily users)?");
  if (tags.length === 0) q.push("Are there any compliance frameworks in scope (HIPAA, PCI, SOC 2, Zero Trust)?");
  if (q.length === 0) q.push("Should I optimize this draft for cost or for performance?");
  return q;
}

function guessName(prompt: string): string {
  const words = prompt.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3);
  const stop = new Set(["with", "that", "this", "need", "want", "build", "using", "should", "would", "have", "make", "system", "platform", "architecture", "design"]);
  const key = words.filter((w) => !stop.has(w.toLowerCase())).slice(0, 2);
  if (key.length === 0) return "New Architecture";
  return key.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") + " Platform";
}

export const EXAMPLE_PROMPTS = [
  "A HIPAA-compliant patient records API with async document processing",
  "A multi-region e-commerce checkout backend that handles Black Friday traffic",
  "A serverless event pipeline that ingests IoT telemetry and powers a dashboard",
  "Kubernetes microservices for a fintech app with Zero Trust networking",
];
