<div align="center">

# SmArchitect

**An end-to-end, AI-native cloud architecture platform: design, evaluate, comply, and ship infrastructure as code — across AWS and every other cloud — from one canvas.**

</div>

---

Describe a system in plain language → a team of AI agents drafts a production-ready
architecture onto an interactive diagram → edit it directly or by talking to it →
estimate cost, audit **Zero Trust**, generate deployable IaC. One graph, four
directions: **generate** it, **edit** it, **export** it, **import** it.

## What's here

```
smarchitect/
├── web/      Next.js 14 + React + TypeScript + Tailwind + React Flow   (the product)
├── server/   FastAPI · LiteLLM gateway · agent pipeline · policy + IaC planes
└── SmArchitect_Platform_Plan.md
```

The **web app is fully functional standalone** — every engine (validation, Zero
Trust compliance, cost, talk-to-edit, IaC generation, version diff) runs client-side,
so it works with **no backend and no API keys**. The **server** mirrors the same
Cloud Resource Graph and adds the LLM-backed agent pipeline when you want it.

## Quick start

```bash
# Frontend (the canvas)
cd web
npm install
npm run dev            # http://localhost:3000

# Backend (optional — Agent / Policy / IaC planes)
cd ../server
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
```

## The five planes

| Plane | What it does | Stack |
|---|---|---|
| **Canvas** | React Flow editor · custom resource nodes · palette · talk-to-edit · compliance lens · version diff | React Flow (xyflow), Tailwind, shadcn-style UI |
| **Agent** | Reqs → Research → Architect → Cost → Security → Compliance, with approval checkpoints | LangGraph-style pipeline → **LiteLLM** gateway |
| **Graph** | Provider-agnostic **Cloud Resource Graph**, versioned, undo/redo, patch log | zustand store + typed CRG model |
| **Policy** | **Zero Trust (NIST 800-207)** + HIPAA / SOC 2 / PCI overlays, evidence + one-click remediation | rule engine, OSCAL-style audit export |
| **IaC** | One graph → Pulumi / Terraform / Helm / CloudFormation, in-UI preview/plan | export adapters (Pulumi Automation API on the server) |

## Highlights

- **Diagram builder** — infinite canvas, drag-from-palette (40+ AWS/Azure/GCP/K8s
  services), tier-based auto-layout, live validation, minimap, version diff.
- **Talk-to-edit** — *"add a Redis cache between the API and the database"*,
  *"make the database multi-region"* → the graph mutates live, model-agnostic via LiteLLM.
- **Zero Trust lens** — toggle a framework and every node lights up pass / partial /
  fail against named controls; one click remediates and adds evidence.
- **Real IaC** — generated Terraform/Pulumi/Helm/CFN with an in-UI Pulumi-style plan
  preview before download.
- **Aggregator** — Connections + Inventory import live accounts and Terraform state,
  with drift detection (read-only, least-privilege).

## Routes (web)

`/` landing · `/dashboard` · `/studio` (the canvas) · `/connections` · `/inventory`
· `/compliance` · `/cost` · `/iac` · `/templates` · `/settings`

> Auth is intentionally out of scope per the project brief.
