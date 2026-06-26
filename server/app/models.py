"""Pydantic models for the Cloud Resource Graph (CRG) — the single source of truth.

Mirrors the TypeScript model in web/src/lib/crg/types.ts so the same graph flows
between the canvas, the agents, the policy plane, and the IaC plane.
"""
from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

CloudProvider = Literal["aws", "azure", "gcp", "k8s", "onprem"]
ServiceCategory = Literal[
    "edge", "network", "compute", "data", "storage",
    "messaging", "security", "observability", "ai",
]
Tier = Literal["edge", "ingress", "compute", "data", "integration", "security", "observability"]
HaMode = Literal["single", "multi-az", "multi-region", "global"]
EdgeKind = Literal["network", "data", "control"]


class SecuritySettings(BaseModel):
    encryptionAtRest: bool = False
    encryptionInTransit: bool = False
    publicAccess: bool = False
    authRequired: bool = False
    mtls: bool = False
    wafEnabled: bool = False
    privateNetworking: bool = False


class ScalingSettings(BaseModel):
    mode: Literal["fixed", "auto"] = "fixed"
    min: int = 1
    max: int = 1


class CostHint(BaseModel):
    monthly: float = 0
    confidence: float = 0.2
    drivers: list[str] = Field(default_factory=list)


class Position(BaseModel):
    x: float = 0
    y: float = 0


class ResourceNode(BaseModel):
    id: str
    name: str
    provider: CloudProvider
    serviceType: str
    category: ServiceCategory
    tier: Tier
    region: str = "us-east-1"
    haMode: HaMode = "single"
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    scaling: ScalingSettings = Field(default_factory=ScalingSettings)
    costHint: CostHint = Field(default_factory=CostHint)
    complianceTags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    position: Position = Field(default_factory=Position)
    driftStatus: Optional[str] = None
    nativeId: Optional[str] = None


class ResourceEdge(BaseModel):
    id: str
    source: str
    target: str
    kind: EdgeKind = "network"
    protocol: Optional[str] = "HTTPS"
    latencyCritical: bool = False
    sensitiveData: bool = False
    label: Optional[str] = None


class CloudResourceGraph(BaseModel):
    nodes: list[ResourceNode] = Field(default_factory=list)
    edges: list[ResourceEdge] = Field(default_factory=list)


# ---- API request/response shapes ----------------------------------------

class GenerateRequest(BaseModel):
    prompt: str
    model: str = "auto"


class RequirementsSpec(BaseModel):
    workloads: list[str]
    nfrs: list[str]
    complianceTags: list[str]
    regions: list[str]
    budgetBand: str
    clarifyingQuestions: list[str]


class GenerateResponse(BaseModel):
    projectName: str
    spec: RequirementsSpec
    graph: CloudResourceGraph
    rationale: str
    stages: list[dict[str, Any]]


class EditRequest(BaseModel):
    graph: CloudResourceGraph
    instruction: str
    model: str = "auto"


class EditResponse(BaseModel):
    matched: bool
    summary: str
    reply: str
    graph: CloudResourceGraph
    changeCount: int


class EvaluateRequest(BaseModel):
    graph: CloudResourceGraph
    framework: str = "zero-trust"
