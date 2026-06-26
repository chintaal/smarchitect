"""Policy plane — Zero Trust (NIST SP 800-207) evaluation + remediation.

Overlays produce evidence mapped to named controls, never a vague 'we added a
WAF'. New frameworks become new rule sets with no code changes.
"""
from __future__ import annotations

from typing import Callable
from .models import CloudResourceGraph, ResourceNode


def _data_like(n: ResourceNode) -> bool:
    return n.category in ("data", "storage")


def _compute(n: ResourceNode) -> bool:
    return n.category == "compute"


def _edge_ingress(n: ResourceNode) -> bool:
    return n.tier in ("edge", "ingress")


# A control = (id, ref, title, predicate over applicable nodes, remediation fn)
CONTROLS: list[dict] = [
    {
        "id": "ZT-1",
        "ref": "NIST SP 800-207 §2.1 Tenet 1",
        "title": "All resources require authentication",
        "subjects": lambda n: _compute(n) or _data_like(n),
        "ok": lambda n: n.security.authRequired,
        "fix": lambda n: setattr(n.security, "authRequired", True),
    },
    {
        "id": "ZT-2",
        "ref": "NIST SP 800-207 §2.1 Tenet 2",
        "title": "All communication secured in transit",
        "subjects": lambda n: not _edge_ingress(n) or _compute(n),
        "ok": lambda n: n.security.encryptionInTransit,
        "fix": lambda n: setattr(n.security, "encryptionInTransit", True),
    },
    {
        "id": "ZT-4",
        "ref": "NIST SP 800-207 §2.1 Tenet 6",
        "title": "No implicit trust by network location",
        "subjects": _data_like,
        "ok": lambda n: not n.security.publicAccess,
        "fix": lambda n: setattr(n.security, "publicAccess", False),
    },
    {
        "id": "ZT-5",
        "ref": "NIST SP 800-207A §3",
        "title": "Workload identity (mTLS) for service-to-service",
        "subjects": _compute,
        "ok": lambda n: n.security.mtls,
        "fix": lambda n: setattr(n.security, "mtls", True),
    },
    {
        "id": "ZT-8",
        "ref": "NIST SP 800-207A §4",
        "title": "Web application firewall at the edge",
        "subjects": _edge_ingress,
        "ok": lambda n: n.security.wafEnabled,
        "fix": lambda n: setattr(n.security, "wafEnabled", True),
    },
]


def evaluate(graph: CloudResourceGraph, framework: str = "zero-trust") -> dict:
    controls = []
    node_status: dict[str, str] = {n.id: "untested" for n in graph.nodes}
    earned = applicable = 0

    for c in CONTROLS:
        subjects = [n for n in graph.nodes if c["subjects"](n)]
        if not subjects:
            controls.append({"controlId": c["id"], "ref": c["ref"], "title": c["title"], "status": "n/a", "affected": []})
            continue
        failed = [n for n in subjects if not c["ok"](n)]
        passed = [n for n in subjects if c["ok"](n)]
        status = "pass" if not failed else "fail" if not passed else "partial"
        applicable += 1
        earned += 1 if status == "pass" else 0.5 if status == "partial" else 0
        for n in passed:
            if node_status[n.id] == "untested":
                node_status[n.id] = "pass"
        for n in failed:
            node_status[n.id] = "fail"
        controls.append({
            "controlId": c["id"], "ref": c["ref"], "title": c["title"],
            "status": status, "affected": [n.id for n in failed],
        })

    score = 100 if applicable == 0 else round(earned / applicable * 100)
    return {"framework": framework, "score": score, "controls": controls, "nodeStatus": node_status}


def remediate(graph: CloudResourceGraph, framework: str = "zero-trust") -> CloudResourceGraph:
    for c in CONTROLS:
        fix: Callable = c["fix"]
        for n in graph.nodes:
            if c["subjects"](n) and not c["ok"](n):
                fix(n)
    return graph
