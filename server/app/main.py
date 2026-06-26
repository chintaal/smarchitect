"""SmArchitect API — FastAPI surface over the five planes.

Run:  uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs

The frontend (web/) runs fully standalone today; point it here by setting
NEXT_PUBLIC_API_URL to enable the LLM-backed agent pipeline.
"""
from __future__ import annotations

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from . import agents, compliance, gateway, iac
from .models import (
    CloudResourceGraph,
    EditRequest,
    EditResponse,
    EvaluateRequest,
    GenerateRequest,
    GenerateResponse,
)

app = FastAPI(
    title="SmArchitect API",
    version="2.0.0",
    description="AI-native cloud architecture: generate, edit, comply, and export — one graph, four directions.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "version": "2.0.0",
        "gateway": "litellm" if gateway.gateway_available() else "deterministic-fallback",
    }


# ---- Agent plane --------------------------------------------------------

@app.post("/api/agents/generate", response_model=GenerateResponse, tags=["agents"])
def generate(req: GenerateRequest) -> GenerateResponse:
    """Run the Reqs→Research→Architect→Cost→Security→Compliance pipeline."""
    return agents.run_generation(req.prompt, req.model)


@app.post("/api/agents/edit", response_model=EditResponse, tags=["agents"])
def edit(req: EditRequest) -> EditResponse:
    """Talk-to-edit: a natural-language instruction → a live graph mutation."""
    return agents.run_edit(req.graph, req.instruction, req.model)


# ---- Policy plane -------------------------------------------------------

@app.post("/api/compliance/evaluate", tags=["compliance"])
def evaluate(req: EvaluateRequest) -> dict:
    """Evaluate the graph against a framework (Zero Trust by default)."""
    return compliance.evaluate(req.graph, req.framework)


@app.post("/api/compliance/remediate", response_model=CloudResourceGraph, tags=["compliance"])
def remediate(req: EvaluateRequest) -> CloudResourceGraph:
    """Apply one-click remediation for every failing control."""
    return compliance.remediate(req.graph, req.framework)


# ---- IaC plane ----------------------------------------------------------

@app.post("/api/iac/terraform", response_class=PlainTextResponse, tags=["iac"])
def terraform(graph: CloudResourceGraph) -> str:
    """Emit deployable Terraform/HCL from the graph."""
    return iac.to_terraform(graph)


# ---- Import plane (stub) ------------------------------------------------

@app.get("/api/import/connections", tags=["import"])
def connections() -> dict:
    """Read-only cloud discovery uses least-privilege roles; no write paths."""
    return {
        "note": "Discovery is read-only by design (Steampipe / provider SDKs).",
        "connections": [],
    }
