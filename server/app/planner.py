"""Deterministic CRG planner — builds and edits graphs without an LLM.

This is the fallback that keeps GENERATE and EDIT working with no API key, and
the structured tool the LLM agents call to actually mutate the graph.
"""
from __future__ import annotations

import re
import secrets
from .models import (
    CloudResourceGraph,
    CostHint,
    Position,
    RequirementsSpec,
    ResourceEdge,
    ResourceNode,
    ScalingSettings,
    SecuritySettings,
)

# Minimal service catalog (key -> defaults). Mirrors the frontend catalog.
CATALOG: dict[str, dict] = {
    "aws.cloudfront": dict(provider="aws", category="edge", tier="edge", cost=35, ha="global"),
    "aws.route53": dict(provider="aws", category="network", tier="edge", cost=5, ha="global"),
    "aws.alb": dict(provider="aws", category="network", tier="ingress", cost=22, ha="multi-az"),
    "aws.apigw": dict(provider="aws", category="network", tier="ingress", cost=30, ha="single"),
    "aws.ecs": dict(provider="aws", category="compute", tier="compute", cost=90, ha="single"),
    "aws.lambda": dict(provider="aws", category="compute", tier="compute", cost=18, ha="single"),
    "aws.eks": dict(provider="aws", category="compute", tier="compute", cost=150, ha="single"),
    "aws.rds": dict(provider="aws", category="data", tier="data", cost=140, ha="multi-az"),
    "aws.dynamodb": dict(provider="aws", category="data", tier="data", cost=45, ha="multi-region"),
    "aws.elasticache": dict(provider="aws", category="data", tier="data", cost=55, ha="multi-az"),
    "aws.s3": dict(provider="aws", category="storage", tier="data", cost=25, ha="multi-region"),
    "aws.sqs": dict(provider="aws", category="messaging", tier="integration", cost=8, ha="single"),
    "aws.cloudwatch": dict(provider="aws", category="observability", tier="observability", cost=18, ha="single"),
    "aws.secrets": dict(provider="aws", category="security", tier="security", cost=10, ha="single"),
}

HA_FACTOR = {"single": 1.0, "multi-az": 1.6, "multi-region": 2.4, "global": 3.0}


def _id() -> str:
    return secrets.token_hex(4)


def make_node(key: str, x: float = 0, y: float = 0, **over) -> ResourceNode:
    c = CATALOG[key]
    label = key.split(".")[-1].upper()
    return ResourceNode(
        id=_id(),
        name=over.pop("name", label),
        provider=c["provider"],
        serviceType=key,
        category=c["category"],
        tier=c["tier"],
        haMode=c["ha"],
        costHint=CostHint(monthly=c["cost"], confidence=0.2, drivers=[f"{label} baseline"]),
        scaling=ScalingSettings(),
        security=SecuritySettings(**over.pop("security", {})),
        position=Position(x=x, y=y),
        **over,
    )


def make_edge(source: str, target: str, **over) -> ResourceEdge:
    return ResourceEdge(id=_id(), source=source, target=target, **over)


def _three_tier() -> CloudResourceGraph:
    dns = make_node("aws.route53")
    cdn = make_node("aws.cloudfront")
    alb = make_node("aws.alb", security={"publicAccess": True, "encryptionInTransit": True})
    ecs = make_node("aws.ecs", name="API Service")
    rds = make_node("aws.rds", name="Primary DB")
    cache = make_node("aws.elasticache")
    s3 = make_node("aws.s3", name="Assets Bucket")
    g = CloudResourceGraph(
        nodes=[dns, cdn, alb, ecs, rds, cache, s3],
        edges=[
            make_edge(dns.id, cdn.id, kind="control", protocol="DNS"),
            make_edge(cdn.id, alb.id),
            make_edge(alb.id, ecs.id),
            make_edge(ecs.id, rds.id, kind="data", sensitiveData=True, latencyCritical=True),
            make_edge(ecs.id, cache.id, kind="data"),
            make_edge(ecs.id, s3.id, kind="data"),
        ],
    )
    return auto_layout(recompute_cost(g))


def _serverless() -> CloudResourceGraph:
    api = make_node("aws.apigw", security={"publicAccess": True, "authRequired": True, "encryptionInTransit": True})
    fn = make_node("aws.lambda", name="Orders Fn")
    ddb = make_node("aws.dynamodb", name="Orders Table")
    sqs = make_node("aws.sqs")
    cw = make_node("aws.cloudwatch")
    g = CloudResourceGraph(
        nodes=[api, fn, ddb, sqs, cw],
        edges=[
            make_edge(api.id, fn.id),
            make_edge(fn.id, ddb.id, kind="data", sensitiveData=True),
            make_edge(fn.id, sqs.id, kind="data"),
            make_edge(fn.id, cw.id, kind="control"),
        ],
    )
    return auto_layout(recompute_cost(g))


TEMPLATES = {"three-tier": _three_tier, "serverless": _serverless}


def recompute_cost(g: CloudResourceGraph) -> CloudResourceGraph:
    for n in g.nodes:
        base = CATALOG.get(n.serviceType, {}).get("cost", n.costHint.monthly)
        monthly = base * HA_FACTOR.get(n.haMode, 1.0)
        if n.category == "compute" and n.scaling.mode == "auto":
            monthly *= max(1, (n.scaling.min + n.scaling.max) / 2)
        n.costHint.monthly = round(monthly)
    return g


def auto_layout(g: CloudResourceGraph) -> CloudResourceGraph:
    cols = ["edge", "ingress", "compute", "integration", "data", "security", "observability"]
    buckets: dict[str, list[ResourceNode]] = {}
    for n in g.nodes:
        buckets.setdefault(n.tier, []).append(n)
    for tier, nodes in buckets.items():
        col = cols.index(tier) if tier in cols else 2
        for i, n in enumerate(nodes):
            n.position = Position(x=80 + col * 300, y=80 + i * 132)
    return g


def generate_from_prompt(prompt: str) -> tuple[str, RequirementsSpec, CloudResourceGraph, str]:
    p = prompt.lower()
    tpl = "three-tier"
    if re.search(r"serverless|lambda|event[- ]driven|functions?", p):
        tpl = "serverless"
    graph = TEMPLATES[tpl]()

    tags: list[str] = []
    if re.search(r"hipaa|phi|health|patient", p):
        tags.append("HIPAA")
    if re.search(r"pci|payment|card|checkout", p):
        tags.append("PCI DSS")
    if re.search(r"zero ?trust|ztna", p) or tags:
        tags.append("Zero Trust")

    regions = ["us-east-1"]
    if re.search(r"multi[- ]region|global|dr", p):
        regions = ["us-east-1", "us-west-2"]

    spec = RequirementsSpec(
        workloads=["HTTP API", "Relational datastore"],
        nfrs=["High availability (multi-AZ)", "Encryption everywhere"],
        complianceTags=sorted(set(tags)),
        regions=regions,
        budgetBand="Balanced",
        clarifyingQuestions=["What is the expected peak traffic?"] if "traffic" not in p else [],
    )
    name = (re.findall(r"[A-Za-z]{4,}", prompt)[:2] or ["New"])
    project = " ".join(w.capitalize() for w in name) + " Platform"
    rationale = f"Selected the '{tpl}' pattern and scaffolded {len(graph.nodes)} resources."
    return project, spec, graph, rationale


_ADD = [
    (r"redis|cache", "aws.elasticache"),
    (r"cdn|cloudfront", "aws.cloudfront"),
    (r"api gateway|apigw", "aws.apigw"),
    (r"load balancer|alb", "aws.alb"),
    (r"database|postgres|rds|db", "aws.rds"),
    (r"queue|sqs", "aws.sqs"),
    (r"lambda|function", "aws.lambda"),
    (r"monitoring|observability|cloudwatch", "aws.cloudwatch"),
    (r"secret", "aws.secrets"),
]


def apply_instruction(g: CloudResourceGraph, raw: str) -> tuple[bool, str, str, CloudResourceGraph, int]:
    text = raw.lower().strip()

    if re.search(r"remove|delete|drop", text):
        term = re.sub(r".*(remove|delete|drop)\s*(the|all)?\s*", "", text).strip(".?! ")
        targets = [n for n in g.nodes if term and (term in n.name.lower() or term in n.serviceType)]
        if targets:
            ids = {n.id for n in targets}
            g.nodes = [n for n in g.nodes if n.id not in ids]
            g.edges = [e for e in g.edges if e.source not in ids and e.target not in ids]
            return True, f"Removed {len(targets)} node(s)", f"Removed {len(targets)} node(s).", recompute_cost(g), len(targets)

    if re.search(r"multi.?region|multi.?az|global|highly available", text):
        mode = "multi-az" if "az" in text else "global" if "global" in text else "multi-region"
        targets = [n for n in g.nodes if n.category == "data"]
        for n in targets:
            n.haMode = mode  # type: ignore[assignment]
        if targets:
            return True, f"Set {len(targets)} node(s) to {mode}", f"Set {len(targets)} data node(s) to {mode}.", recompute_cost(g), len(targets)

    if re.search(r"add|insert|create", text):
        for pat, key in _ADD:
            if re.search(pat, text):
                node = make_node(key, x=240, y=160)
                g.nodes.append(node)
                return True, f"Added {key}", f"Added a **{node.name}** to the canvas.", recompute_cost(g), 1

    return False, "", "I didn't catch a concrete change. Try 'add a redis cache' or 'make the database multi-region'.", g, 0
