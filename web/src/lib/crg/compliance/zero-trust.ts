import type { CloudResourceGraph, ResourceNode } from "../types";
import { getService } from "../catalog";
import { makeNode } from "../factory";
import { cloneGraph, type Control, type ComplianceFramework, type ControlEvaluation } from "./shared";

/* Helpers -------------------------------------------------------------- */

const isCompute = (n: ResourceNode) => n.category === "compute";
const isDataLike = (n: ResourceNode) => n.category === "data" || n.category === "storage";
const isEdgeIngress = (n: ResourceNode) => n.tier === "edge" || n.tier === "ingress";

function hasInternalNeighbors(g: CloudResourceGraph, nodeId: string): boolean {
  return g.edges.some((e) => {
    if (e.source !== nodeId && e.target !== nodeId) return false;
    const otherId = e.source === nodeId ? e.target : e.source;
    const other = g.nodes.find((n) => n.id === otherId);
    return other ? !isEdgeIngress(other) : false;
  });
}

function evalResult(
  controlId: string,
  affected: ResourceNode[],
  passing: ResourceNode[],
  evidenceWhenPass: string,
  evidenceWhenFail: string,
): ControlEvaluation {
  const applicable = affected.length + passing.length;
  if (applicable === 0) {
    return {
      controlId,
      status: "n/a",
      affectedNodeIds: [],
      passNodeIds: [],
      evidence: "No applicable resources in the graph.",
    };
  }
  return {
    controlId,
    status: affected.length === 0 ? "pass" : passing.length === 0 ? "fail" : "partial",
    affectedNodeIds: affected.map((n) => n.id),
    passNodeIds: passing.map((n) => n.id),
    evidence: affected.length === 0 ? evidenceWhenPass : evidenceWhenFail,
  };
}

function patchNodes(
  g: CloudResourceGraph,
  predicate: (n: ResourceNode) => boolean,
  patch: (n: ResourceNode) => void,
): CloudResourceGraph {
  const next = cloneGraph(g);
  for (const n of next.nodes) if (predicate(n)) patch(n);
  return next;
}

/* Controls — NIST SP 800-207 (Zero Trust Architecture) + 800-207A ------- */

const ZT1: Control = {
  id: "ZT-1",
  ref: "NIST SP 800-207 §2.1 Tenet 1",
  title: "All resources require authentication",
  description:
    "Every data source and computing service is treated as a resource; access is authenticated, never granted by implicit network trust.",
  remediation: "Require authentication on all compute and data resources.",
  evaluate: (g) => {
    const subjects = g.nodes.filter((n) => isCompute(n) || isDataLike(n));
    const affected = subjects.filter((n) => !n.security.authRequired);
    const passing = subjects.filter((n) => n.security.authRequired);
    return evalResult(
      "ZT-1",
      affected,
      passing,
      "All compute and data resources enforce authentication.",
      `${affected.length} resource(s) accept unauthenticated access.`,
    );
  },
  remediate: (g) =>
    patchNodes(g, (n) => isCompute(n) || isDataLike(n), (n) => {
      n.security.authRequired = true;
    }),
};

const ZT2: Control = {
  id: "ZT-2",
  ref: "NIST SP 800-207 §2.1 Tenet 2",
  title: "All communication secured in transit",
  description:
    "Communication is secured regardless of network location. Traffic on the most trusted internal network is encrypted to the same standard as external traffic.",
  remediation: "Enable encryption in transit (TLS) on every non-edge resource.",
  evaluate: (g) => {
    const subjects = g.nodes.filter((n) => !isEdgeIngress(n) || isCompute(n));
    const affected = subjects.filter((n) => !n.security.encryptionInTransit);
    const passing = subjects.filter((n) => n.security.encryptionInTransit);
    return evalResult(
      "ZT-2",
      affected,
      passing,
      "Every resource enforces encryption in transit.",
      `${affected.length} resource(s) allow plaintext communication.`,
    );
  },
  remediate: (g) =>
    patchNodes(g, (n) => !isEdgeIngress(n) || isCompute(n), (n) => {
      n.security.encryptionInTransit = true;
    }),
};

const ZT3: Control = {
  id: "ZT-3",
  ref: "NIST SP 800-207 §3.1 (Policy Enforcement Point)",
  title: "Per-session access via a policy enforcement point",
  description:
    "Access to individual resources is granted per-session and brokered by a policy enforcement point (API gateway / authenticating ingress) rather than direct exposure.",
  remediation: "Place an authenticating API gateway or ingress in front of public compute.",
  evaluate: (g) => {
    const hasPEP = g.nodes.some(
      (n) => isEdgeIngress(n) && n.security.authRequired && (getService(n.serviceType)?.category === "network"),
    );
    const exposedCompute = g.nodes.filter((n) => isCompute(n) && n.security.publicAccess);
    if (exposedCompute.length === 0) {
      const compute = g.nodes.filter(isCompute);
      return evalResult(
        "ZT-3",
        [],
        compute,
        "No compute is directly exposed; access is brokered.",
        "",
      );
    }
    const affected = hasPEP ? [] : exposedCompute;
    return evalResult(
      "ZT-3",
      affected,
      hasPEP ? exposedCompute : [],
      "An authenticating enforcement point brokers access to compute.",
      "Public compute has no authenticating policy enforcement point in front of it.",
    );
  },
  remediate: (g) => {
    const next = cloneGraph(g);
    // Enable auth on existing edge/ingress, otherwise drop public access on compute.
    let pep = next.nodes.find((n) => isEdgeIngress(n) && getService(n.serviceType)?.category === "network");
    if (pep) {
      pep.security.authRequired = true;
    } else {
      for (const n of next.nodes) if (isCompute(n)) n.security.publicAccess = false;
    }
    return next;
  },
};

const ZT4: Control = {
  id: "ZT-4",
  ref: "NIST SP 800-207 §2.1 Tenet 6",
  title: "No implicit trust by network location",
  description:
    "Resources are not trusted simply because they sit inside the network perimeter. Data stores are never directly reachable from the public internet.",
  remediation: "Disable public access on data and storage; require private networking.",
  evaluate: (g) => {
    const stores = g.nodes.filter(isDataLike);
    const affected = stores.filter((n) => n.security.publicAccess || n.security.privateNetworking === false);
    const passing = stores.filter((n) => !n.security.publicAccess && n.security.privateNetworking !== false);
    return evalResult(
      "ZT-4",
      affected,
      passing,
      "Data stores are private and not reachable from the public internet.",
      `${affected.length} data store(s) are exposed beyond the trusted boundary.`,
    );
  },
  remediate: (g) =>
    patchNodes(g, isDataLike, (n) => {
      n.security.publicAccess = false;
      n.security.privateNetworking = true;
    }),
};

const ZT5: Control = {
  id: "ZT-5",
  ref: "NIST SP 800-207A §3 (Identity-based segmentation)",
  title: "Workload identity (mTLS / SPIFFE) for service-to-service",
  description:
    "Cloud-native ZTA establishes per-workload identity. Service-to-service calls authenticate with mutual TLS / SPIFFE rather than network position.",
  remediation: "Enable mTLS on compute workloads that communicate internally.",
  evaluate: (g) => {
    const compute = g.nodes.filter((n) => isCompute(n) && hasInternalNeighbors(g, n.id));
    const affected = compute.filter((n) => !n.security.mtls);
    const passing = compute.filter((n) => n.security.mtls);
    return evalResult(
      "ZT-5",
      affected,
      passing,
      "Internal workloads authenticate one another with mTLS.",
      `${affected.length} workload(s) communicate without mutual TLS identity.`,
    );
  },
  remediate: (g) =>
    patchNodes(g, (n) => isCompute(n), (n) => {
      n.security.mtls = true;
    }),
};

const ZT6: Control = {
  id: "ZT-6",
  ref: "NIST SP 800-207 §2.1 Tenet 7",
  title: "Continuous monitoring of asset integrity",
  description:
    "The enterprise collects telemetry about the current state of assets and uses it to improve security posture. An observability plane must be present.",
  remediation: "Add an observability/monitoring service to the architecture.",
  evaluate: (g) => {
    const hasObs = g.nodes.some((n) => n.category === "observability");
    const compute = g.nodes.filter(isCompute);
    if (compute.length === 0) {
      return { controlId: "ZT-6", status: "n/a", affectedNodeIds: [], passNodeIds: [], evidence: "No workloads to monitor." };
    }
    return {
      controlId: "ZT-6",
      status: hasObs ? "pass" : "fail",
      affectedNodeIds: hasObs ? [] : compute.map((n) => n.id),
      passNodeIds: hasObs ? g.nodes.filter((n) => n.category === "observability").map((n) => n.id) : [],
      evidence: hasObs
        ? "An observability plane monitors asset integrity."
        : "No observability/monitoring plane is present.",
    };
  },
  remediate: (g) => {
    if (g.nodes.some((n) => n.category === "observability")) return g;
    const next = cloneGraph(g);
    const maxX = Math.max(0, ...next.nodes.map((n) => n.position.x));
    const obs = makeNode("aws.cloudwatch", { x: maxX + 320, y: 80 });
    next.nodes.push(obs);
    return next;
  },
};

const ZT7: Control = {
  id: "ZT-7",
  ref: "NIST SP 800-207 §3.4.1 (Dynamic credentials)",
  title: "Centralized, encrypted secret management",
  description:
    "Credentials are dynamically issued and centrally managed. When databases are present, a secret manager should broker access rather than static credentials.",
  remediation: "Add a managed secret store (e.g. Secrets Manager) for database credentials.",
  evaluate: (g) => {
    const dbs = g.nodes.filter((n) => n.category === "data");
    if (dbs.length === 0) {
      return { controlId: "ZT-7", status: "n/a", affectedNodeIds: [], passNodeIds: [], evidence: "No databases present." };
    }
    const hasSecrets = g.nodes.some((n) => n.serviceType.includes("secret"));
    return {
      controlId: "ZT-7",
      status: hasSecrets ? "pass" : "partial",
      affectedNodeIds: hasSecrets ? [] : dbs.map((n) => n.id),
      passNodeIds: hasSecrets ? g.nodes.filter((n) => n.serviceType.includes("secret")).map((n) => n.id) : [],
      evidence: hasSecrets
        ? "A managed secret store brokers credentials."
        : "Database credentials are not managed by a central secret store.",
    };
  },
  remediate: (g) => {
    if (g.nodes.some((n) => n.serviceType.includes("secret"))) return g;
    const next = cloneGraph(g);
    const maxX = Math.max(0, ...next.nodes.map((n) => n.position.x));
    next.nodes.push(makeNode("aws.secrets", { x: maxX + 320, y: 240 }));
    return next;
  },
};

const ZT8: Control = {
  id: "ZT-8",
  ref: "NIST SP 800-207A §4 (Edge protection / PEP)",
  title: "Web application firewall at the edge",
  description:
    "Inbound traffic passes through a policy enforcement point that inspects and filters requests. Edge/ingress nodes should have a WAF enabled.",
  remediation: "Enable WAF on internet-facing edge and ingress resources.",
  evaluate: (g) => {
    const edges = g.nodes.filter((n) => isEdgeIngress(n) && n.security.publicAccess !== false);
    const affected = edges.filter((n) => !n.security.wafEnabled);
    const passing = edges.filter((n) => n.security.wafEnabled);
    return evalResult(
      "ZT-8",
      affected,
      passing,
      "Internet-facing entry points are protected by a WAF.",
      `${affected.length} entry point(s) lack a web application firewall.`,
    );
  },
  remediate: (g) =>
    patchNodes(g, (n) => isEdgeIngress(n), (n) => {
      n.security.wafEnabled = true;
      n.security.encryptionInTransit = true;
    }),
};

export const ZERO_TRUST: ComplianceFramework = {
  id: "zero-trust",
  name: "Zero Trust Architecture",
  short: "Zero Trust",
  authority: "NIST",
  catalog: "NIST SP 800-207 / 800-207A",
  description:
    "The seven tenets of Zero Trust: never trust, always verify. Per-session access, encrypted everywhere, identity-based segmentation, continuous monitoring.",
  accent: "primary",
  controls: [ZT1, ZT2, ZT3, ZT4, ZT5, ZT6, ZT7, ZT8],
};
