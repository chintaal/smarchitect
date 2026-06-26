import type { CloudResourceGraph, HaMode, ResourceNode } from "./types";
import { CATALOG, getService } from "./catalog";
import { makeEdge, makeNode } from "./factory";
import { cloneGraph } from "./compliance/shared";

export interface TalkResult {
  matched: boolean;
  summary: string;
  /** Human-readable explanation streamed back into the chat. */
  reply: string;
  graph?: CloudResourceGraph;
  changeCount: number;
}

/** Keyword → catalog service key for "add" intents. */
const ADD_KEYWORDS: { match: RegExp; key: string; label: string }[] = [
  { match: /\b(redis|cache|elasticache|memcached)\b/, key: "aws.elasticache", label: "Redis cache" },
  { match: /\b(cdn|cloudfront|content delivery)\b/, key: "aws.cloudfront", label: "CloudFront CDN" },
  { match: /\b(waf|firewall)\b/, key: "aws.waf", label: "WAF" },
  { match: /\b(api gateway|apigateway|api gw)\b/, key: "aws.apigw", label: "API Gateway" },
  { match: /\b(load balancer|alb|elb|balancer)\b/, key: "aws.alb", label: "load balancer" },
  { match: /\b(postgres|rds|sql database|relational|database|db)\b/, key: "aws.rds", label: "PostgreSQL database" },
  { match: /\b(dynamo|nosql|key.?value)\b/, key: "aws.dynamodb", label: "DynamoDB" },
  { match: /\b(queue|sqs)\b/, key: "aws.sqs", label: "SQS queue" },
  { match: /\b(topic|pubsub|sns|notification)\b/, key: "aws.sns", label: "SNS topic" },
  { match: /\b(kinesis|stream)\b/, key: "aws.kinesis", label: "Kinesis stream" },
  { match: /\b(lambda|serverless function|function)\b/, key: "aws.lambda", label: "Lambda function" },
  { match: /\b(container|ecs|fargate)\b/, key: "aws.ecs", label: "ECS service" },
  { match: /\b(kubernetes|eks|k8s)\b/, key: "aws.eks", label: "EKS cluster" },
  { match: /\b(object storage|s3|bucket|blob)\b/, key: "aws.s3", label: "S3 bucket" },
  { match: /\b(monitoring|observability|cloudwatch|metrics|logging)\b/, key: "aws.cloudwatch", label: "CloudWatch" },
  { match: /\b(secret|vault|secrets manager)\b/, key: "aws.secrets", label: "Secrets Manager" },
  { match: /\b(cognito|identity|auth|authentication)\b/, key: "aws.cognito", label: "Cognito identity" },
  { match: /\b(ec2|virtual machine|vm|instance|server)\b/, key: "aws.ec2", label: "EC2 instance" },
];

function findNode(graph: CloudResourceGraph, term: string): ResourceNode | undefined {
  const t = term.toLowerCase().trim();
  if (!t) return undefined;
  // exact name
  let hit = graph.nodes.find((n) => n.name.toLowerCase() === t);
  if (hit) return hit;
  // contains name / service label / category / serviceType
  hit = graph.nodes.find((n) => {
    const svc = getService(n.serviceType);
    return (
      n.name.toLowerCase().includes(t) ||
      (svc?.label.toLowerCase().includes(t) ?? false) ||
      n.category === t ||
      n.serviceType.includes(t)
    );
  });
  if (hit) return hit;
  // category synonyms
  const synonym: Record<string, string> = {
    api: "compute",
    database: "data",
    db: "data",
    cache: "data",
    storage: "storage",
    queue: "messaging",
  };
  const cat = synonym[t];
  if (cat) return graph.nodes.find((n) => n.category === (cat as ResourceNode["category"]));
  return undefined;
}

function findNodes(graph: CloudResourceGraph, term: string): ResourceNode[] {
  const t = term.toLowerCase().trim();
  return graph.nodes.filter((n) => {
    const svc = getService(n.serviceType);
    return (
      n.name.toLowerCase().includes(t) ||
      (svc?.label.toLowerCase().includes(t) ?? false) ||
      n.serviceType.includes(t) ||
      n.category === t
    );
  });
}

function resolveAddKey(text: string): { key: string; label: string } | undefined {
  for (const k of ADD_KEYWORDS) if (k.match.test(text)) return { key: k.key, label: k.label };
  // try catalog labels directly
  const svc = CATALOG.find((s) => text.includes(s.label.toLowerCase()) || text.includes(s.fullName.toLowerCase()));
  return svc ? { key: svc.key, label: svc.label } : undefined;
}

/**
 * Deterministic talk-to-edit parser. Maps a natural-language instruction to a
 * graph mutation. The /api/chat route can layer an LLM on top, but this keeps
 * the builder fully functional with no API key.
 */
export function applyInstruction(graph: CloudResourceGraph, raw: string): TalkResult {
  const text = raw.toLowerCase().trim();
  const g = cloneGraph(graph);

  // ---- REMOVE ----
  if (/\b(remove|delete|drop|get rid of)\b/.test(text)) {
    const term = text.replace(/.*\b(remove|delete|drop|get rid of)\b\s*(the|all|every)?\s*/, "").replace(/[.?!]$/, "");
    const targets = findNodes(g, term);
    if (targets.length === 0) return miss(`I couldn't find anything matching "${term}" to remove.`);
    const ids = new Set(targets.map((n) => n.id));
    g.nodes = g.nodes.filter((n) => !ids.has(n.id));
    g.edges = g.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target));
    return {
      matched: true,
      summary: `Removed ${targets.length} node(s)`,
      reply: `Removed ${targets.map((n) => `"${n.name}"`).join(", ")} and any connected edges.`,
      graph: g,
      changeCount: targets.length,
    };
  }

  // ---- HA / multi-region ----
  const haMatch = text.match(/\b(multi.?region|multi.?az|globally|global|highly available|high availability)\b/);
  if (haMatch && /\b(make|set|go|turn|move)\b/.test(text)) {
    const mode: HaMode = /multi.?az/.test(text) ? "multi-az" : /global/.test(text) ? "global" : "multi-region";
    const term = text.replace(/.*\b(make|set|move|go|turn)\b\s*(the)?\s*/, "").replace(/\b(multi.?region|multi.?az|global|globally|highly available|high availability)\b.*/, "").trim();
    const targets = term ? findNodes(g, term) : g.nodes.filter((n) => n.category === "data");
    if (targets.length === 0) return miss(`I couldn't find "${term || "a target"}" to make ${mode}.`);
    for (const n of targets) {
      const node = g.nodes.find((x) => x.id === n.id)!;
      node.haMode = mode;
    }
    return {
      matched: true,
      summary: `Set ${targets.length} node(s) to ${mode}`,
      reply: `Set ${targets.map((n) => `"${n.name}"`).join(", ")} to **${mode}** high-availability.`,
      graph: g,
      changeCount: targets.length,
    };
  }

  // ---- SECURITY toggles ----
  if (/\b(encrypt|encryption|make .* private|disable public|lock down|secure)\b/.test(text)) {
    const term = text.replace(/.*\b(encrypt|make|secure|lock down)\b\s*(the)?\s*/, "").replace(/\b(private|secure|encrypted|encryption|public).*/, "").trim();
    const targets = term ? findNodes(g, term) : g.nodes.filter((n) => n.category === "data" || n.category === "storage");
    if (targets.length === 0) return miss(`I couldn't find "${term}" to secure.`);
    for (const t of targets) {
      const node = g.nodes.find((x) => x.id === t.id)!;
      node.security.encryptionAtRest = true;
      node.security.encryptionInTransit = true;
      node.security.publicAccess = false;
      node.security.privateNetworking = true;
    }
    return {
      matched: true,
      summary: `Hardened ${targets.length} node(s)`,
      reply: `Enabled encryption (at rest + in transit) and made ${targets.map((n) => `"${n.name}"`).join(", ")} private.`,
      graph: g,
      changeCount: targets.length,
    };
  }

  // ---- CONNECT ----
  const connect = text.match(/\bconnect\b\s+(.+?)\s+(?:to|with|and)\s+(.+)/);
  if (connect) {
    const a = findNode(g, connect[1]);
    const b = findNode(g, connect[2]);
    if (!a || !b) return miss(`I couldn't resolve both endpoints to connect.`);
    g.edges.push(makeEdge(a.id, b.id));
    return { matched: true, summary: `Connected ${a.name} → ${b.name}`, reply: `Connected **${a.name}** → **${b.name}**.`, graph: g, changeCount: 1 };
  }

  // ---- ADD ----
  if (/\b(add|insert|put|place|create|introduce)\b/.test(text)) {
    const resolved = resolveAddKey(text);
    if (!resolved) return miss(`I couldn't tell which service to add. Try "add a Redis cache between the API and the database".`);
    const svc = getService(resolved.key)!;

    // "between X and Y"
    const between = text.match(/between\s+(.+?)\s+and\s+(.+)/);
    if (between) {
      const a = findNode(g, between[1]);
      const b = findNode(g, between[2]);
      if (a && b) {
        const pos = { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 + 40 };
        const node = makeNode(resolved.key, pos);
        g.nodes.push(node);
        // rewire a->b through the new node
        g.edges = g.edges.filter((e) => !(e.source === a.id && e.target === b.id));
        g.edges.push(makeEdge(a.id, node.id), makeEdge(node.id, b.id));
        return {
          matched: true,
          summary: `Inserted ${svc.label} between ${a.name} and ${b.name}`,
          reply: `Inserted a **${resolved.label}** between **${a.name}** and **${b.name}**, rerouting traffic through it.`,
          graph: g,
          changeCount: 3,
        };
      }
    }

    // "in front of / before X"  or "to/after X"
    const rel = text.match(/(?:in front of|before|ahead of|to|after|behind)\s+(?:the\s+)?(.+)/);
    const anchor = rel ? findNode(g, rel[1]) : undefined;
    const pos = anchor
      ? { x: anchor.position.x + (/(?:in front of|before|ahead of)/.test(text) ? -260 : 260), y: anchor.position.y }
      : { x: 120 + Math.random() * 120, y: 120 + Math.random() * 120 };
    const node = makeNode(resolved.key, pos);
    g.nodes.push(node);
    if (anchor) {
      if (/(?:in front of|before|ahead of)/.test(text)) g.edges.push(makeEdge(node.id, anchor.id));
      else g.edges.push(makeEdge(anchor.id, node.id));
    }
    return {
      matched: true,
      summary: `Added ${svc.label}`,
      reply: anchor
        ? `Added a **${resolved.label}** and wired it to **${anchor.name}**.`
        : `Added a **${resolved.label}** to the canvas. Drag an edge to connect it.`,
      graph: g,
      changeCount: anchor ? 2 : 1,
    };
  }

  return miss(
    `I didn't catch a concrete change there. Try things like:\n• "add a Redis cache between the API and the database"\n• "make the database multi-region"\n• "remove the Lambdas"\n• "encrypt the S3 bucket"`,
  );
}

function miss(reply: string): TalkResult {
  return { matched: false, summary: "", reply, changeCount: 0 };
}
