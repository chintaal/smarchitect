# SmArchitect — Backend (Agent · Policy · IaC planes)

FastAPI service that mirrors the frontend's Cloud Resource Graph and exposes the
agent pipeline, the Zero Trust policy plane, and IaC generation. It runs **with
zero credentials** (deterministic planner) and upgrades to real LLM agents when a
LiteLLM gateway / provider key is configured.

## Run

```bash
cd server
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# OpenAPI docs at http://localhost:8000/docs
```

### Optional: enable real LLM agents via LiteLLM

```bash
export ANTHROPIC_API_KEY=...        # or OPENAI_API_KEY / GEMINI_API_KEY
# or run the gateway and point at it:
litellm --config litellm.config.yaml
export LITELLM_BASE_URL=http://localhost:4000
export LITELLM_MASTER_KEY=sk-...
```

With a gateway present, each agent stage routes its model call through one
OpenAI-compatible endpoint (`litellm.config.yaml`), with routing + fallback. The
graph itself is always built by the deterministic planner tool, so output is a
valid CRG regardless of the model.

## Endpoints

| Method | Path | Plane | Purpose |
|---|---|---|---|
| `GET`  | `/health` | — | status + which gateway is active |
| `POST` | `/api/agents/generate` | Agent | brief → spec + architecture graph |
| `POST` | `/api/agents/edit` | Agent | talk-to-edit instruction → graph mutation |
| `POST` | `/api/compliance/evaluate` | Policy | Zero Trust (NIST 800-207) pass/fail + score |
| `POST` | `/api/compliance/remediate` | Policy | one-click remediation of failing controls |
| `POST` | `/api/iac/terraform` | IaC | graph → deployable Terraform/HCL |
| `GET`  | `/api/import/connections` | Import | read-only discovery (stub) |

## Layout

```
app/
  models.py      Pydantic CRG (mirrors web/src/lib/crg/types.ts)
  gateway.py     LiteLLM wrapper with graceful fallback
  agents.py      LangGraph-style pipeline (6 agents + checkpoints)
  planner.py     Deterministic CRG generate/edit tool the agents call
  compliance.py  Zero Trust controls (evaluate + remediate)
  iac.py         Terraform emitter
  main.py        FastAPI app
litellm.config.yaml   gateway routing + fallback + budgets
```
