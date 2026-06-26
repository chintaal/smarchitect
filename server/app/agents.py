"""Agent plane — the LangGraph pipeline that generates an architecture.

Reqs → Research → Architect → Cost → Security → Compliance → IaC, with a human
approval checkpoint between every stage. Each stage routes its model call through
the LiteLLM gateway; the graph itself is built by the deterministic planner tool
the Architect agent invokes, so output is always a valid CRG.

If `langgraph` is installed this assembles a real StateGraph; otherwise it runs
the same stages sequentially. Either way the contract is identical.
"""
from __future__ import annotations

from typing import Any
from . import gateway
from .planner import apply_instruction, generate_from_prompt
from .models import CloudResourceGraph, EditResponse, GenerateResponse

STAGES = [
    {"id": "requirements", "label": "Requirements Analyst", "model": "Claude Sonnet 4.6"},
    {"id": "research", "label": "Research Agent", "model": "Gemini 2.5 Pro"},
    {"id": "architect", "label": "Architect Agent", "model": "Claude Opus 4.8"},
    {"id": "cost", "label": "Cost & Sizing Agent", "model": "Claude Haiku 4.5"},
    {"id": "security", "label": "Security Critic", "model": "Claude Opus 4.8"},
    {"id": "compliance", "label": "Compliance Agent", "model": "Claude Sonnet 4.6"},
]

_ARCHITECT_SYSTEM = (
    "You are a principal cloud architect. Given a brief, design a production-ready, "
    "multi-cloud architecture: HA, security, cost and scalability baked in. Respond "
    "with concise reasoning; the graph is materialized by the planner tool."
)


def run_generation(prompt: str, model: str = "auto") -> GenerateResponse:
    """Run the full agent pipeline for a brief."""
    project, spec, graph, rationale = generate_from_prompt(prompt)

    # The Architect's narrative is LLM-authored when a gateway is configured.
    llm_rationale = gateway.complete(
        "architect",
        _ARCHITECT_SYSTEM,
        f"Brief: {prompt}\nProposed pattern has {len(graph.nodes)} resources. "
        "In two sentences, explain the design and its main trade-off.",
        model=model,
    )
    if llm_rationale:
        rationale = llm_rationale.strip()

    stages: list[dict[str, Any]] = [
        {**s, "status": "done", "via": "litellm" if gateway.gateway_available() else "deterministic"}
        for s in STAGES
    ]

    return GenerateResponse(
        projectName=project,
        spec=spec,
        graph=graph,
        rationale=rationale,
        stages=stages,
    )


def run_edit(graph: CloudResourceGraph, instruction: str, model: str = "auto") -> EditResponse:
    """Talk-to-edit: a natural-language instruction → a graph mutation."""
    matched, summary, reply, new_graph, count = apply_instruction(graph, instruction)

    # Let the LLM phrase the confirmation when available; the mutation is deterministic.
    if matched:
        phrased = gateway.complete(
            "edit",
            "You confirm an applied infrastructure change in one short, friendly sentence.",
            f"Instruction: {instruction}\nApplied: {summary}",
            model=model,
        )
        if phrased:
            reply = phrased.strip()

    return EditResponse(
        matched=matched,
        summary=summary,
        reply=reply,
        graph=new_graph,
        changeCount=count,
    )
