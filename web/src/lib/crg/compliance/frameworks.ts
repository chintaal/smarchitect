import type { ResourceNode } from "../types";
import { cloneGraph, evalSimple, type ComplianceFramework, type Control } from "./shared";

const isDataLike = (n: ResourceNode) => n.category === "data" || n.category === "storage";

/* ---- HIPAA ----------------------------------------------------------- */

const HIPAA_ENCRYPT: Control = {
  id: "HIPAA-164.312(a)(2)(iv)",
  ref: "HIPAA Security Rule §164.312(a)(2)(iv)",
  title: "Encryption of ePHI at rest",
  description: "Electronic protected health information must be encrypted at rest.",
  remediation: "Enable encryption at rest on all data and storage resources.",
  evaluate: (g) =>
    evalSimple(
      "HIPAA-164.312(a)(2)(iv)",
      g.nodes.filter(isDataLike),
      (n) => n.security.encryptionAtRest,
      "All ePHI stores are encrypted at rest.",
      "data store(s) hold ePHI without encryption at rest.",
    ),
  remediate: (g) => {
    const next = cloneGraph(g);
    for (const n of next.nodes) if (isDataLike(n)) n.security.encryptionAtRest = true;
    return next;
  },
};

const HIPAA_TRANSIT: Control = {
  id: "HIPAA-164.312(e)(1)",
  ref: "HIPAA Security Rule §164.312(e)(1)",
  title: "Transmission security",
  description: "ePHI transmitted over networks must be protected against unauthorized access.",
  remediation: "Enforce encryption in transit on all resources.",
  evaluate: (g) =>
    evalSimple(
      "HIPAA-164.312(e)(1)",
      g.nodes.filter((n) => n.tier !== "edge"),
      (n) => n.security.encryptionInTransit,
      "All transmissions are encrypted.",
      "resource(s) transmit ePHI without encryption in transit.",
    ),
  remediate: (g) => {
    const next = cloneGraph(g);
    for (const n of next.nodes) if (n.tier !== "edge") n.security.encryptionInTransit = true;
    return next;
  },
};

const HIPAA_AUDIT: Control = {
  id: "HIPAA-164.312(b)",
  ref: "HIPAA Security Rule §164.312(b)",
  title: "Audit controls",
  description: "Mechanisms must record and examine activity in systems that contain ePHI.",
  remediation: "Add an observability/audit-logging service.",
  evaluate: (g) => {
    const hasObs = g.nodes.some((n) => n.category === "observability");
    const data = g.nodes.filter(isDataLike);
    if (data.length === 0)
      return { controlId: "HIPAA-164.312(b)", status: "n/a", affectedNodeIds: [], passNodeIds: [], evidence: "No ePHI stores." };
    return {
      controlId: "HIPAA-164.312(b)",
      status: hasObs ? "pass" : "fail",
      affectedNodeIds: hasObs ? [] : data.map((n) => n.id),
      passNodeIds: hasObs ? g.nodes.filter((n) => n.category === "observability").map((n) => n.id) : [],
      evidence: hasObs ? "Audit logging is in place." : "No audit-logging mechanism is present.",
    };
  },
};

export const HIPAA: ComplianceFramework = {
  id: "hipaa",
  name: "HIPAA Security Rule",
  short: "HIPAA",
  authority: "HHS",
  catalog: "45 CFR Part 164 Subpart C",
  description: "Safeguards for electronic protected health information (ePHI).",
  accent: "success",
  controls: [HIPAA_ENCRYPT, HIPAA_TRANSIT, HIPAA_AUDIT],
};

/* ---- SOC 2 ----------------------------------------------------------- */

const SOC2_ENC: Control = {
  id: "SOC2-CC6.1",
  ref: "SOC 2 CC6.1",
  title: "Logical access — encryption",
  description: "Logical access controls protect information assets, including encryption at rest.",
  remediation: "Encrypt all data and storage at rest.",
  evaluate: (g) =>
    evalSimple(
      "SOC2-CC6.1",
      g.nodes.filter(isDataLike),
      (n) => n.security.encryptionAtRest,
      "Information assets are encrypted at rest.",
      "asset(s) lack encryption at rest.",
    ),
  remediate: (g) => {
    const next = cloneGraph(g);
    for (const n of next.nodes) if (isDataLike(n)) n.security.encryptionAtRest = true;
    return next;
  },
};

const SOC2_BOUNDARY: Control = {
  id: "SOC2-CC6.6",
  ref: "SOC 2 CC6.6",
  title: "Protection against external threats",
  description: "Boundary protection restricts access from outside the system boundary.",
  remediation: "Disable public access on data stores; add WAF at the edge.",
  evaluate: (g) =>
    evalSimple(
      "SOC2-CC6.6",
      g.nodes.filter(isDataLike),
      (n) => !n.security.publicAccess,
      "Data assets are protected behind the boundary.",
      "asset(s) are exposed outside the system boundary.",
    ),
  remediate: (g) => {
    const next = cloneGraph(g);
    for (const n of next.nodes) if (isDataLike(n)) n.security.publicAccess = false;
    return next;
  },
};

const SOC2_MONITOR: Control = {
  id: "SOC2-CC7.2",
  ref: "SOC 2 CC7.2",
  title: "System monitoring",
  description: "The entity monitors system components for anomalies indicative of incidents.",
  remediation: "Add an observability service.",
  evaluate: (g) => {
    const hasObs = g.nodes.some((n) => n.category === "observability");
    const compute = g.nodes.filter((n) => n.category === "compute");
    if (compute.length === 0)
      return { controlId: "SOC2-CC7.2", status: "n/a", affectedNodeIds: [], passNodeIds: [], evidence: "No components to monitor." };
    return {
      controlId: "SOC2-CC7.2",
      status: hasObs ? "pass" : "fail",
      affectedNodeIds: hasObs ? [] : compute.map((n) => n.id),
      passNodeIds: hasObs ? g.nodes.filter((n) => n.category === "observability").map((n) => n.id) : [],
      evidence: hasObs ? "System monitoring is configured." : "No monitoring is configured.",
    };
  },
};

export const SOC2: ComplianceFramework = {
  id: "soc2",
  name: "SOC 2 (Trust Services)",
  short: "SOC 2",
  authority: "AICPA",
  catalog: "AICPA Trust Services Criteria",
  description: "Security, availability, and confidentiality common criteria.",
  accent: "warning",
  controls: [SOC2_ENC, SOC2_BOUNDARY, SOC2_MONITOR],
};

/* ---- PCI DSS --------------------------------------------------------- */

const PCI_NETSEG: Control = {
  id: "PCI-1.3",
  ref: "PCI DSS v4.0 Req. 1.3",
  title: "Restrict inbound/outbound to CDE",
  description: "Network access to the cardholder data environment is restricted; data stores are private.",
  remediation: "Make all data stores private (no public access).",
  evaluate: (g) =>
    evalSimple(
      "PCI-1.3",
      g.nodes.filter(isDataLike),
      (n) => !n.security.publicAccess && n.security.privateNetworking !== false,
      "Cardholder data environment is network-segmented.",
      "store(s) in the CDE are not properly segmented.",
    ),
  remediate: (g) => {
    const next = cloneGraph(g);
    for (const n of next.nodes)
      if (isDataLike(n)) {
        n.security.publicAccess = false;
        n.security.privateNetworking = true;
      }
    return next;
  },
};

const PCI_ENC: Control = {
  id: "PCI-3.5",
  ref: "PCI DSS v4.0 Req. 3.5",
  title: "Protect stored account data",
  description: "Primary account numbers are rendered unreadable (encrypted) wherever stored.",
  remediation: "Encrypt all data stores at rest.",
  evaluate: (g) =>
    evalSimple(
      "PCI-3.5",
      g.nodes.filter(isDataLike),
      (n) => n.security.encryptionAtRest,
      "Stored account data is encrypted.",
      "store(s) hold account data without encryption.",
    ),
  remediate: (g) => {
    const next = cloneGraph(g);
    for (const n of next.nodes) if (isDataLike(n)) n.security.encryptionAtRest = true;
    return next;
  },
};

const PCI_WAF: Control = {
  id: "PCI-6.4.2",
  ref: "PCI DSS v4.0 Req. 6.4.2",
  title: "Web application firewall",
  description: "Public-facing web applications are protected by an automated technical solution (WAF).",
  remediation: "Enable WAF on internet-facing entry points.",
  evaluate: (g) =>
    evalSimple(
      "PCI-6.4.2",
      g.nodes.filter((n) => (n.tier === "edge" || n.tier === "ingress") && n.security.publicAccess !== false),
      (n) => !!n.security.wafEnabled,
      "Public-facing applications are protected by a WAF.",
      "entry point(s) lack a web application firewall.",
    ),
  remediate: (g) => {
    const next = cloneGraph(g);
    for (const n of next.nodes) if (n.tier === "edge" || n.tier === "ingress") n.security.wafEnabled = true;
    return next;
  },
};

export const PCI: ComplianceFramework = {
  id: "pci",
  name: "PCI DSS v4.0",
  short: "PCI DSS",
  authority: "PCI SSC",
  catalog: "PCI DSS v4.0",
  description: "Protection of cardholder data in the cardholder data environment (CDE).",
  accent: "destructive",
  controls: [PCI_NETSEG, PCI_ENC, PCI_WAF],
};
