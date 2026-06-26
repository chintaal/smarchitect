# SmArchitect — Platform Plan

**An end-to-end, AI-native cloud architecture platform: design, evaluate, comply, and ship infrastructure as code — across AWS and every other cloud — from one canvas.**

*Version 2.0 · Project Plan Document · Excludes authentication scope by design*

---

## 0. One-paragraph pitch

SmArchitect is a single platform where a cloud architect and a cloud engineer do their entire job. You describe a system in plain language; a team of AI agents (powered by any model, routed through LiteLLM) drafts a production-ready architecture onto an interactive diagram canvas; you edit it directly or by talking to it; the platform estimates cost, audits security, applies compliance frameworks like Zero Trust / HIPAA / SOC2 / PCI as machine-readable overlays, and generates deployable Infrastructure-as-Code (Pulumi, Terraform, Kubernetes/Helm, CloudFormation). It is also an **aggregator**: it imports live AWS, Azure, and GCP accounts and existing Terraform state, so the same canvas documents what you already run and detects drift. One graph, four directions: generate it, edit it, export it, import it.

---

## 1. What changed from v1, and why

The original SmArchitect was a good generator but had three ceilings. This plan removes all three and expands the surface into a full platform.

| v1 limitation | v2 resolution |
|---|---|
| Read-only diagrams (you couldn't really edit) | Full interactive **diagram builder** on React Flow with AI-assisted, talk-to-edit workflow |
| AWS-only | **Multi-cloud aggregator** — AWS, Azure, GCP, Kubernetes, on-prem, via a provider-agnostic resource graph |
| Single hardcoded model (one provider) | **LiteLLM gateway** — route any task to any of 100+ models with fallback, budgets, and cost tracking |
| Overlays as if/else Python | **Policy-as-code** compliance plane grounded in real control catalogs (NIST 800-207, OSCAL) |
| One-direction pipeline (reqs → diagram → code) | **Bidirectional** — also imports live cloud + Terraform state, does drift detection |
| Terraform HCL only | **Pulumi core** + multi-format export (Terraform, Helm, CloudFormation) |

---

## 2. Product principles

1. **The canvas is the product.** Everything — AI output, imports, edits, compliance changes — lands on one editable diagram. If it can't be shown and edited on the canvas, it doesn't ship.
2. **Model-agnostic by default.** No task is welded to one LLM. LiteLLM lets each agent pick the best/cheapest model and fall back automatically.
3. **Every artifact is real.** Generated IaC must actually deploy. Imported diagrams must reflect actual resources. No decorative output.
4. **Compliance is evidence, not vibes.** Overlays produce an audit trail mapped to named controls, not just "we added a WAF."
5. **Bidirectional or it's not a platform.** Greenfield design and brownfield documentation share the same graph.

---

## 3. The core model: one graph, four directions

Everything in SmArchitect is a **Cloud Resource Graph (CRG)** — a provider-agnostic, versioned directed graph.

- **Nodes** = cloud resources (compute, storage, network, data, messaging, security, edge), each carrying rich metadata: provider, service type, tier, region, HA mode, security settings, scaling, cost hints, and compliance annotations.
- **Edges** = connections (network / data / control), each with protocol, latency-criticality, and data-sensitivity flags.

Four data-flow directions act on the same CRG:

```
                    ┌─────────────────────────┐
   GENERATE  ──────►│                         │──────►  EXPORT
   (AI agents)      │   Cloud Resource Graph  │         (IaC: Pulumi/TF/
                    │   - provider-agnostic   │          Helm/CFN)
   IMPORT    ──────►│   - versioned           │──────►  EDIT
   (live cloud +    │   - single source       │         (canvas + talk-
    TF state)       │     of truth            │          to-edit)
                    └─────────────────────────┘
```

This single abstraction is what makes the platform coherent instead of a bundle of separate tools.

---

## 4. Technology stack (decisions + rationale)

### 4.1 Diagram builder / canvas — **React Flow (xyflow)**
The architecture graph maps 1:1 to a node-edge canvas, so React Flow is the natural fit — MIT-licensed, free, purpose-built for this. We render **custom resource nodes** styled with official cloud icons sourced from `@cloud-diagrams/core`, which ships **1,100+ official AWS / Azure / GCP service icons** with TypeScript types and SVG export. (We reuse its icon registry and service taxonomy; we do *not* use it as the canvas engine.)

*Optional later:* the tldraw SDK for freeform annotation/whiteboarding and built-in multiplayer — defer until needed, since its commercial production license is **$6,000/year per team**.

### 4.2 LLM layer — **LiteLLM gateway** (the diagram builder's engine)
LiteLLM is the open-source AI gateway that exposes **100+ providers behind one OpenAI-compatible API** (OpenAI, Anthropic, Gemini, Bedrock, Azure, local Ollama/vLLM). We self-host the **Proxy Server** so every agent call goes through one endpoint with:
- **Routing + fallback**: rules by latency, cost, round-robin, or weighted; auto-retry to a secondary model/provider when one is throttled or down.
- **Per-task model selection**: the cheap, fast model drafts node labels; the strong model designs full architectures; whichever is cheapest handles cost math — all swappable in YAML.
- **Cost tracking + budgets**: spend per project/user/virtual key, logged to Postgres.
- **Guardrails + observability**: PII masking, content filtering, and callbacks to Langfuse/MLflow for tracing.

This directly delivers your requirement that "the diagram builder should work really well using LiteLLM": the builder calls one stable endpoint and the platform stays model-agnostic and resilient.

### 4.3 Agent orchestration — **LangGraph** (model calls via LiteLLM)
LangGraph is the 2026 production standard for **stateful, auditable agentic workflows with human-in-the-loop and checkpointing** — exactly right for an architecture tool where the architect approves/edits between stages. Agents are nodes in a typed-state directed graph (mirroring our own CRG), with conditional edges and the ability to re-enter at any point rather than running as a brittle one-shot chain. (If the team prefers an all-TypeScript stack, **Mastra** is the TS-native alternative.)

### 4.4 IaC engine — **Pulumi core**, multi-format export
Pulumi exposes the **Automation API**, a programmatic SDK to drive `preview`/`up`/`destroy` from inside another program — purpose-built for a self-service portal like ours. Terraform has no programmatic equivalent. Pulumi also covers **150+ providers** with one model (solving multi-cloud), can **reference Terraform modules directly**, and treats secrets as first-class encrypted values. We still **emit Terraform/HCL, Helm, and CloudFormation** as export formats because many teams require them — generated, not authored by hand. (Note: CDKTF is deprecated; we don't build on it.)

### 4.5 Compliance plane — **OSCAL + Open Policy Agent (Rego)**
Overlays are declarative rule sets grounded in real catalogs: **NIST SP 800-207** (Zero Trust core components) and **800-207A** (ZTA for cloud-native, multi-cloud, microservices — API gateways, sidecars, SPIFFE identity). Controls encoded in **OSCAL** map to concrete graph mutations *and* produce a machine-readable audit artifact. **OPA/Rego** (or Pulumi CrossGuard) evaluates the graph and emits pass/fail + remediation. New frameworks (FedRAMP, ISO 27001) become new rule sets, no code changes.

### 4.6 Supporting stack
- **Backend:** FastAPI (async; pairs naturally with LangGraph + Pulumi Automation API in Python).
- **Frontend:** Next.js + React + TypeScript + Tailwind + shadcn/ui (same ecosystem as React Flow).
- **Data:** PostgreSQL (projects, versioned graph snapshots, patch log, audit, spend) + Redis (cache, sessions, agent state).
- **Cloud import:** Steampipe / provider SDKs for read-only discovery; Terraform state parser.
- **Deploy:** Docker + Docker Compose (local), Kubernetes/Helm (prod), Nginx ingress.
- **Observability:** Langfuse (LLM traces) + OpenTelemetry + Prometheus/Grafana.

---

## 5. Platform architecture (five planes)

```
┌──────────────────────────────────────────────────────────────────────┐
│  CANVAS PLANE   React Flow editor · custom resource nodes · property   │
│                 panels · diff view · talk-to-edit · compliance lens    │
├──────────────────────────────────────────────────────────────────────┤
│  AGENT PLANE    LangGraph state machine  ──calls──►  LiteLLM gateway   │
│                 Reqs→Research→Architect→Cost→Security→Compliance→IaC    │
│                 human-approval checkpoints between every stage         │
├──────────────────────────────────────────────────────────────────────┤
│  GRAPH PLANE    Cloud Resource Graph (single source of truth)          │
│                 versioned snapshots + patch log                        │
├──────────────────────────────────────────────────────────────────────┤
│  POLICY PLANE   OSCAL catalogs + OPA/Rego · overlays as graph          │
│                 transforms · audit evidence output                     │
├──────────────────────────────────────────────────────────────────────┤
│  IAC PLANE      Pulumi Automation API engine · export adapters         │
│                 (Terraform / Helm / CloudFormation) · preview/plan      │
├──────────────────────────────────────────────────────────────────────┤
│  IMPORT PLANE   live AWS/Azure/GCP discovery · TF-state import ·        │
│                 drift detection ──► writes into Graph Plane            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Full feature list

### 6.1 Diagram builder (the centerpiece)
- Infinite canvas, pan/zoom, snapping, auto-layout (tier-based), minimap.
- Custom resource nodes with official AWS/Azure/GCP icons; drag-from-palette.
- Inline property editing via side panel; multi-select; group/ungroup by tier or VPC.
- **Talk-to-edit**: "add a Redis cache between the API and the database," "make the DB multi-region," "remove the Lambdas" → graph mutation rendered live (LiteLLM-routed).
- **Generate-to-canvas**: agents stream a full architecture onto the canvas.
- Live validation (invalid edges, missing required config, orphan nodes flagged).
- **Version diff view**: visual before/after between any two versions.
- Export diagram as SVG/PNG; export as Mermaid.

### 6.2 AI agents (LangGraph + LiteLLM)
- **Requirements Analyst** — natural language → structured spec (workloads, NFRs, compliance tags, constraints, budget, regions), with clarifying questions.
- **Research Agent** — pulls current service docs/pricing/best practices (cached).
- **Architect Agent** — generates production-ready multi-cloud graphs (HA, security, cost, scalability baked in).
- **Multi-Cloud Mapper** — translates between AWS ↔ Azure ↔ GCP ↔ open-source/on-prem equivalents.
- **Cost & Sizing Agent** — monthly estimate with confidence bands + optimization suggestions.
- **Security Critic** — SPOFs, encryption gaps, network risks, compliance gaps, severity-ranked.
- **Compliance Agent** — applies overlays, produces audit evidence.
- **IaC Generator** — produces Pulumi/Terraform/Helm/CFN.
- Human approval + edit checkpoint between every stage.

### 6.3 Aggregator / import (AWS and everything)
- Read-only connect to AWS, Azure, GCP → auto-discover resources → build the CRG.
- Import existing Terraform state / HCL → reconstruct the graph.
- **Drift detection**: diff the live account against the designed graph; highlight added/removed/changed.
- Forgotten-resource and cost-anomaly surfacing.
- Multi-account / multi-region inventory with filtering.

### 6.4 Compliance & security
- Overlays: Zero Trust (800-207/207A), HIPAA, SOC2, PCI — combinable (e.g. Zero Trust + HIPAA).
- **Compliance lens** on the canvas: toggle a framework, see which nodes pass/fail, one-click remediation.
- OSCAL-backed audit report export (PDF/JSON) per framework.
- Extensible: FedRAMP, ISO 27001, NIST CSF as future rule sets.

### 6.5 Cost intelligence
- Per-node and total monthly estimates with cost drivers.
- AWS-vs-Azure-vs-GCP-vs-private comparison reports with trade-off analysis (cost, ops burden, lock-in).
- What-if scenarios (change region/instance/HA mode → see cost delta).
- Aggregated LLM spend dashboard (from LiteLLM) so users see their own AI usage cost.

### 6.6 IaC generation & deployment
- One graph → Pulumi (TS/Python/Go), Terraform HCL, Kubernetes/Helm, CloudFormation.
- Modular output (vpc/compute/data/security modules), variables, outputs, README.
- **Preview/plan in-UI** before download or deploy (via Pulumi Automation API).
- Download as ZIP; or push to a connected git repo.

### 6.7 Collaboration & lifecycle
- Projects as containers; multiple architecture variants per project.
- Full version history, rollback, audit trail of every change (who/what/when).
- Decision reports comparing variants.
- Templates library (reference architectures to start from).
- Comments/annotations on the canvas.
- (Multiplayer real-time editing is a later phase via tldraw sync or Yjs.)

---

## 7. UI / UX flow

### 7.1 Information architecture & navigation
Persistent **left sidebar** (primary nav) + **top bar** (project context, model selector, spend meter) + **contextual right panel** (properties / AI chat / compliance).

```
LOGO  SmArchitect
─────────────────────
🏠  Dashboard          ← projects grid, recent activity, cost summary
✏️  Design Studio       ← THE canvas (builder + AI + compliance lens)
🔌  Connections        ← link AWS/Azure/GCP accounts; import TF state
🔍  Inventory          ← imported resources, drift, multi-account view
🛡️  Compliance         ← overlays, audit reports, framework status
💰  Cost               ← estimates, comparisons, what-if, LLM spend
📦  IaC & Deploy       ← generated code, preview/plan, export, git push
📚  Templates          ← reference architectures
⚙️  Settings           ← models (LiteLLM config), budgets, providers
─────────────────────
```

### 7.2 The golden path (primary user flow)
```
1. Dashboard → "New Architecture"
        │
        ▼
2. Describe requirements (free text)  ──► Requirements Analyst confirms spec
        │                                  (clarifying questions inline)
        ▼
3. Design Studio opens · agents stream architecture onto canvas
        │
        ▼
4. EDIT — drag nodes, or talk-to-edit ("add a CDN", "go multi-region")
        │
        ▼
5. Toggle Compliance lens (e.g. Zero Trust) → see gaps → one-click remediate
        │
        ▼
6. Cost panel → estimate + AWS vs Azure vs GCP comparison
        │
        ▼
7. IaC & Deploy → preview Pulumi/Terraform plan → download or push to git
```

### 7.3 The aggregator path (brownfield)
```
Connections → link AWS account (read-only) → Inventory auto-populates
        │
        ▼
Open in Design Studio → real resources rendered as CRG → drift highlighted
        │
        ▼
Edit / document / compliance-audit the existing estate → export updated IaC
```

### 7.4 Design Studio layout (the main screen)
```
┌──────────┬───────────────────────────────────────┬──────────────┐
│ PALETTE  │                                       │ RIGHT PANEL  │
│ (drag    │           INFINITE CANVAS             │ ┌──────────┐ │
│  cloud   │        (React Flow + icons)           │ │Properties│ │
│  nodes,  │                                       │ ├──────────┤ │
│  grouped │     ●──network──►●──data──►●           │ │ AI Chat  │ │
│  by      │     ALB          API      RDS         │ │(talk-to- │ │
│  service │                                       │ │  edit)   │ │
│  +       │                                       │ ├──────────┤ │
│  search) │                                       │ │Compliance│ │
│          │  [minimap]            [auto-layout]   │ │  lens    │ │
└──────────┴───────────────────────────────────────┴──────────────┘
  Bottom bar: version selector · diff · cost estimate · validation status
```

### 7.5 Component system
shadcn/ui + Tailwind for: command palette (⌘K for talk-to-edit and navigation), resizable panels, data tables (inventory/cost), dialogs, toasts, tabs, tooltips, severity badges (compliance/security), code viewer with syntax highlighting (IaC), diff viewer, and a model-selector dropdown wired to LiteLLM's available models.

### 7.6 Branding & logo
- **Name:** SmArchitect (Smart Architect).
- **Logo concept:** a hexagonal node (the universal "cloud service" shape) with three connected edges forming a subtle upward arrow — "structured systems, built up." Monoline, works at favicon size.
- **Wordmark:** "Sm" in medium weight, "Architect" in regular; the hex glyph replaces a letter accent.
- **Palette:** deep slate/navy base (infrastructure seriousness), electric blue primary (the "smart"/AI accent), with semantic colors for compliance status (green/amber/red) and provider accents (AWS orange, Azure blue, GCP multi). Dark mode first.
- **Type:** Inter or Geist for UI; JetBrains Mono for code/IaC.
- *(Deliverable: an SVG logo + favicon + a small design-token set defined in Phase 1.)*

---

## 8. Data model (core entities)

| Entity | Key fields |
|---|---|
| **Project** | id, name, description, created/updated |
| **Architecture** | id, project_id, name, variant (aws/azure/gcp/private/multi), requirements (JSONB), graph_data (JSONB), cost_band, monthly_estimate, parent_version_id, version_number |
| **ResourceNode** (embedded) | id, name, provider, service_type, tier, region, ha_mode, security{}, scaling{}, cost_hint{}, compliance_tags[], metadata{} |
| **ResourceEdge** (embedded) | id, source, target, type, protocol, latency_critical, sensitive_data |
| **PatchHistory** | id, architecture_id, intent, patch_data (JSONB), applied_at, applied_by |
| **CloudConnection** | id, provider, scope, status, last_synced (read-only credentials handled outside this scope) |
| **ImportedResource** | id, connection_id, native_id, mapped_node_id, drift_status |
| **ComplianceRun** | id, architecture_id, framework, oscal_result (JSONB), pass/fail, remediations[] |
| **LLMSpend** | id, project_id, model, tokens, cost, task_type, timestamp (from LiteLLM callbacks) |

---

## 9. Build roadmap (phased)

| Phase | Theme | Key deliverables | Approx. weeks |
|---|---|---|---|
| **1** | Editor foundation | React Flow canvas, `@cloud-diagrams/core` icon nodes, CRG data model + versioning, property panels, **logo + design tokens** | 1–4 |
| **2** | LLM + agents | LiteLLM gateway live, LangGraph pipeline generating to canvas, **talk-to-edit**, human-approval checkpoints | 5–9 |
| **3** | IaC engine | Pulumi Automation API generation, Terraform/Helm/CFN export, in-UI preview/plan | 10–13 |
| **4** | Compliance + cost | OSCAL + OPA policy plane, 4 overlays, compliance lens, cost estimation + comparison reports | 14–17 |
| **5** | Aggregator | Live AWS/Azure/GCP discovery, TF-state import, drift detection, Inventory views | 18–22 |
| **6** | Production + polish | Templates library, decision reports, observability, perf hardening, docs, deploy charts | 23–26 |
| **7** *(optional)* | Collaboration | Real-time multiplayer (tldraw sync / Yjs), comments, git push | 27+ |

*(Auth is intentionally out of scope per the brief; a thin user/role stub is assumed to exist or be added separately.)*

---

## 10. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| LLM produces invalid graphs | Strict schema validation + auto-regeneration; LangGraph checkpoints catch before render |
| Generated IaC doesn't deploy | Pulumi preview/plan gate before export; validation against provider schemas |
| Multi-cloud mapping is lossy | Mapper flags non-equivalent translations + operational-complexity warnings |
| LLM cost runs away | LiteLLM per-project budgets + cheap-model routing for low-stakes tasks |
| Canvas perf on big graphs | Virtualize/cull off-screen nodes; cluster by tier; React Flow handles ~hundreds of nodes, paginate beyond |
| Import read-access security | Read-only roles only; least-privilege; no write paths in import plane |
| Compliance over-promising | Overlays produce evidence mapped to named controls; never claim certification, only adherence |

---

## 11. Why this is genuinely end-to-end

A user can walk in with *nothing but a sentence* and walk out with a deployable, cost-estimated, compliance-audited, multi-cloud architecture — or walk in with an *existing AWS account* and walk out with a documented, drift-checked, exportable model of it. Same canvas, same graph, same platform. The diagram builder is the front door, LiteLLM makes the intelligence flexible and resilient, LangGraph makes it auditable, Pulumi makes it real, OSCAL makes the compliance defensible, and the import plane makes it an aggregator rather than just a generator.

---

*End of plan document.*
