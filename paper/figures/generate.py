#!/usr/bin/env python3
"""Regenerate all SmArchitect paper figures (PNG + PDF).

Run from repo root:
    pip install -r paper/figures/requirements.txt
    python paper/figures/generate.py
"""
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import networkx as nx
import numpy as np

OUT = Path(__file__).resolve().parent

# SmArchitect palette (from web/src/app/globals.css + paper resultblue)
PRIMARY = "#3B9BFB"
PRIMARY_DARK = "#145AAA"
SUCCESS = "#29A84A"
WARNING = "#F9B22C"
FAIL = "#E04848"
MUTED = "#8A96A8"
BG = "#FFFFFF"
CARD = "#F4F6F9"
BORDER = "#D8DEE8"
AWS = "#FF9900"
AZURE = "#0078D4"
GCP = "#4285F4"
PRIVATE = "#6B7280"

TIER_COLORS = {
    "edge": "#6366F1",
    "ingress": PRIMARY,
    "compute": "#0EA5E9",
    "data": SUCCESS,
    "storage": SUCCESS,
    "integration": WARNING,
    "observability": MUTED,
    "security": FAIL,
}

plt.rcParams.update(
    {
        "font.family": "sans-serif",
        "font.sans-serif": ["Helvetica", "Arial", "DejaVu Sans"],
        "font.size": 9,
        "axes.labelsize": 9,
        "axes.titlesize": 10,
        "figure.dpi": 150,
        "savefig.dpi": 300,
        "savefig.bbox": "tight",
        "savefig.pad_inches": 0.08,
    }
)


def _save(fig: plt.Figure, name: str) -> list[Path]:
    paths: list[Path] = []
    for ext in ("png", "pdf"):
        p = OUT / f"{name}.{ext}"
        fig.savefig(p, facecolor=BG, edgecolor="none")
        paths.append(p)
    plt.close(fig)
    return paths


def _rounded_box(ax, xy, w, h, text, fc=CARD, ec=BORDER, fontsize=8, lw=1.0):
    x, y = xy
    box = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle="round,pad=0.02,rounding_size=0.08",
        facecolor=fc,
        edgecolor=ec,
        linewidth=lw,
    )
    ax.add_patch(box)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fontsize, wrap=True)
    return box


def fig_crg_schema_three_tier() -> list[Path]:
    """CRG formal schema + three-tier example from planner.py templates."""
    fig, axes = plt.subplots(1, 2, figsize=(10.5, 4.2), gridspec_kw={"width_ratios": [1, 1.15]})

    # --- Left: schema ---
    ax = axes[0]
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis("off")
    ax.set_title(r"Cloud Resource Graph $G=(V,E,\Phi_V,\Phi_E)$", fontsize=10, color=PRIMARY_DARK, pad=8)

    _rounded_box(ax, (0.4, 7.2), 4.2, 1.6, r"Node $v \in V$" + "\n" + r"$\Phi_V$: provider, tier, HA, $\sigma(v)$", fc="#EEF4FC", ec=PRIMARY)
    _rounded_box(ax, (5.0, 7.2), 4.6, 1.6, r"Edge $e \in E$" + "\n" r"$\Phi_E$: kind, proto, $s(e)$", fc="#EEF4FC", ec=PRIMARY)

    sigma = (
        r"$\sigma(v)=\{\mathrm{auth},\mathrm{encT},\mathrm{encR},"
        r"\mathrm{pub},\mathrm{mtls},\mathrm{waf},\mathrm{priv}\}$"
    )
    ax.text(5, 6.0, sigma, ha="center", va="center", fontsize=7.5, color=MUTED)

    _rounded_box(ax, (0.8, 3.6), 3.6, 1.4, r"Trust $\tau(v)$" + "\nuntrusted / dmz / trusted", fc=CARD)
    _rounded_box(ax, (5.6, 3.6), 3.6, 1.4, r"Attack surface $A(G)$" + "\npublic exposure + reachability", fc=CARD)
    _rounded_box(ax, (2.2, 1.2), 5.6, 1.5, r"Zero-Trust score $S_{\mathrm{ZT}}(G)=\sum w_i c_i(G)$", fc="#E8F5EC", ec=SUCCESS)

    # --- Right: three-tier graph ---
    ax = axes[1]
    ax.set_title("Three-tier template (planner.py)", fontsize=10, color=PRIMARY_DARK, pad=8)
    G = nx.DiGraph()
    nodes = [
        ("Route53", "edge"),
        ("CloudFront", "edge"),
        ("ALB", "ingress"),
        ("ECS", "compute"),
        ("RDS", "data"),
        ("ElastiCache", "data"),
        ("S3", "storage"),
    ]
    edges = [
        ("Route53", "CloudFront", "ctrl"),
        ("CloudFront", "ALB", "net"),
        ("ALB", "ECS", "net"),
        ("ECS", "RDS", "data"),
        ("ECS", "ElastiCache", "data"),
        ("ECS", "S3", "data"),
    ]
    for n, tier in nodes:
        G.add_node(n, tier=tier)
    for u, v, kind in edges:
        G.add_edge(u, v, kind=kind)

    pos = {
        "Route53": (0, 2),
        "CloudFront": (1, 2),
        "ALB": (2, 2),
        "ECS": (3, 2),
        "RDS": (4, 3),
        "ElastiCache": (4, 2),
        "S3": (4, 1),
    }
    tier_legend = {}
    for n, data in G.nodes(data=True):
        c = TIER_COLORS.get(data["tier"], MUTED)
        tier_legend[data["tier"]] = c
        nx.draw_networkx_nodes(
            G,
            pos,
            nodelist=[n],
            node_color=c,
            node_size=1100,
            alpha=0.92,
            ax=ax,
            edgecolors="white",
            linewidths=1.2,
        )
    nx.draw_networkx_labels(G, pos, font_size=7, font_color="white", font_weight="bold", ax=ax)

    for u, v, d in G.edges(data=True):
        color = SUCCESS if d["kind"] == "data" else MUTED if d["kind"] == "ctrl" else PRIMARY
        ax.annotate(
            "",
            xy=pos[v],
            xytext=pos[u],
            arrowprops=dict(arrowstyle="-|>", color=color, lw=1.4, shrinkA=18, shrinkB=18),
        )

    ax.axis("off")
    ax.set_xlim(-0.4, 4.6)
    ax.set_ylim(0.4, 3.6)
    patches = [mpatches.Patch(color=c, label=t.title()) for t, c in sorted(tier_legend.items())]
    ax.legend(handles=patches, loc="lower center", ncol=4, frameon=False, fontsize=7)

    return _save(fig, "crg-three-tier")


def fig_five_planes() -> list[Path]:
    """Five-plane system architecture (Canvas/Agent/Graph/Policy/IaC)."""
    fig, ax = plt.subplots(figsize=(8.5, 5.2))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis("off")

    planes = [
        ("Canvas", "React Flow editor · talk-to-edit · compliance lens", PRIMARY),
        ("Agent", "Reqs → Research → Architect → Cost → Security → Compliance → IaC", "#6366F1"),
        ("Graph", "CRG single source of truth · versioned snapshots", SUCCESS),
        ("Policy", "ZT-1…ZT-8 · HIPAA/SOC2/PCI overlays · remediation", WARNING),
        ("IaC", "Pulumi / Terraform / Helm / CloudFormation export", AWS),
    ]
    y = 8.6
    for name, desc, color in planes:
        _rounded_box(ax, (0.6, y), 8.8, 1.35, f"{name} plane\n{desc}", fc=CARD, ec=color, lw=1.8)
        y -= 1.65

    # Data flow arrow strip
    flow_y = 0.55
    steps = ["Prompt", "Spec", "CRG", "Optimizer", "Remediated CRG", "IaC"]
    xs = np.linspace(0.9, 9.1, len(steps))
    for i, (x, label) in enumerate(zip(xs, steps)):
        _rounded_box(ax, (x - 0.55, flow_y), 1.1, 0.65, label, fc="#EEF4FC", ec=PRIMARY, fontsize=7)
        if i < len(steps) - 1:
            ax.annotate(
                "",
                xy=(xs[i + 1] - 0.58, flow_y + 0.32),
                xytext=(x + 0.58, flow_y + 0.32),
                arrowprops=dict(arrowstyle="-|>", color=PRIMARY_DARK, lw=1.2),
            )

    ax.text(5, 9.85, "SmArchitect — five planes over one CRG", ha="center", fontsize=11, fontweight="bold", color=PRIMARY_DARK)
    return _save(fig, "five-planes")


def fig_zt_evaluation() -> list[Path]:
    """Zero Trust control evaluation flow on three-tier sample graph."""
    fig, ax = plt.subplots(figsize=(9.5, 4.8))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 6)
    ax.axis("off")
    ax.set_title("Zero-Trust control evaluation (sample three-tier CRG)", fontsize=10, color=PRIMARY_DARK, pad=10)

    # Mini graph (left)
    G = nx.DiGraph()
    node_status = {
        "ALB": "partial",
        "ECS": "fail",
        "RDS": "fail",
        "ElastiCache": "partial",
        "S3": "pass",
        "CloudWatch": "pass",
        "Secrets": "fail",
    }
    status_color = {"pass": SUCCESS, "partial": WARNING, "fail": FAIL, "na": MUTED}
    for n in node_status:
        G.add_node(n)
    for u, v in [("ALB", "ECS"), ("ECS", "RDS"), ("ECS", "ElastiCache"), ("ECS", "S3")]:
        G.add_edge(u, v)
    G.add_node("CloudWatch")
    G.add_node("Secrets")

    pos = {
        "ALB": (0.5, 3),
        "ECS": (1.5, 3),
        "RDS": (2.5, 3.5),
        "ElastiCache": (2.5, 3),
        "S3": (2.5, 2.5),
        "CloudWatch": (1.5, 1.8),
        "Secrets": (2.5, 1.8),
    }
    for n, st in node_status.items():
        nx.draw_networkx_nodes(
            G, pos, nodelist=[n], node_color=status_color[st], node_size=700, ax=ax, edgecolors="white", linewidths=1
        )
    nx.draw_networkx_labels(G, pos, font_size=6.5, font_color="white", font_weight="bold", ax=ax)
    for u, v in G.edges():
        ax.annotate("", xy=pos[v], xytext=pos[u], arrowprops=dict(arrowstyle="-|>", color=MUTED, lw=1, shrinkA=12, shrinkB=12))
    ax.text(1.5, 4.3, "CRG input", ha="center", fontsize=8, color=MUTED)

    # Arrow to engine
    ax.annotate("", xy=(3.6, 3), xytext=(3.0, 3), arrowprops=dict(arrowstyle="-|>", color=PRIMARY_DARK, lw=2))
    _rounded_box(ax, (3.7, 2.5), 1.8, 1.0, "evaluate\nFramework()", fc="#EEF4FC", ec=PRIMARY)

    # ZT controls column
    controls = [
        ("ZT-1", "Auth all resources", "partial"),
        ("ZT-2", "Encrypt in transit", "partial"),
        ("ZT-3", "PEP on public compute", "fail"),
        ("ZT-4", "No implicit trust", "fail"),
        ("ZT-5", "Workload mTLS", "fail"),
        ("ZT-6", "Continuous monitoring", "pass"),
        ("ZT-7", "Central secret store", "fail"),
        ("ZT-8", "WAF at edge", "fail"),
    ]
    y = 4.5
    for cid, title, st in controls:
        _rounded_box(ax, (6.0, y), 1.0, 0.42, cid, fc=status_color[st], ec="white", fontsize=7)
        ax.text(7.15, y + 0.21, title, va="center", fontsize=7)
        ax.text(10.8, y + 0.21, st.upper(), va="center", ha="right", fontsize=7, color=status_color[st], fontweight="bold")
        y -= 0.52

    _rounded_box(ax, (6.0, 0.35), 4.8, 0.55, r"$S_{\mathrm{ZT}} = 37.5$ (weighted score)", fc="#E8F5EC", ec=SUCCESS, fontsize=8)

    legend_patches = [
        mpatches.Patch(color=SUCCESS, label="Pass"),
        mpatches.Patch(color=WARNING, label="Partial"),
        mpatches.Patch(color=FAIL, label="Fail"),
    ]
    ax.legend(handles=legend_patches, loc="upper right", frameon=False, fontsize=7)
    return _save(fig, "zt-evaluation")


def fig_pareto_frontier() -> list[Path]:
    """Illustrative Pareto frontier: cost vs ZT score (synthetic)."""
    rng = np.random.default_rng(42)
    n = 28
    cost = rng.uniform(420, 1450, n)
    zt = 100 - (cost - 420) / 18 + rng.normal(0, 6, n)
    zt = np.clip(zt, 42, 100)
    attack = rng.uniform(2.5, 9.5, n)
    avail = rng.choice([0.5, 0.8, 0.95, 1.0], n)

    # Non-dominated (min cost, max zt)
    nd = []
    for i in range(n):
        dominated = False
        for j in range(n):
            if i != j and cost[j] <= cost[i] and zt[j] >= zt[i] and (cost[j] < cost[i] or zt[j] > zt[i]):
                dominated = True
                break
        if not dominated:
            nd.append(i)
    nd = sorted(nd, key=lambda i: cost[i])
    nd_cost = cost[nd]
    nd_zt = zt[nd]

    fig, ax = plt.subplots(figsize=(6.2, 4.5))
    sc = ax.scatter(
        cost,
        zt,
        c=attack,
        s=40 + avail * 120,
        cmap="YlOrRd",
        alpha=0.75,
        edgecolors=BORDER,
        linewidths=0.4,
    )
    ax.plot(nd_cost, nd_zt, color=PRIMARY_DARK, lw=2.2, marker="o", markersize=5, label="Non-dominated front")
    ax.set_xlabel("Monthly cost $C(G)$ (USD, catalog-indexed)")
    ax.set_ylabel(r"Zero-Trust score $S_{\mathrm{ZT}}(G)$")
    ax.set_title("Multi-objective Pareto frontier (three-tier template)", fontsize=10, color=PRIMARY_DARK)
    ax.grid(True, alpha=0.25, linestyle="--")
    ax.legend(loc="lower left", frameon=True, fontsize=8)
    cbar = fig.colorbar(sc, ax=ax, shrink=0.85)
    cbar.set_label("Attack surface $A(G)$", fontsize=8)
    ax.text(
        0.98,
        0.02,
        "Illustrative synthetic data\n(replace with optimizer CSV)",
        transform=ax.transAxes,
        ha="right",
        va="bottom",
        fontsize=7,
        color=MUTED,
        style="italic",
    )
    return _save(fig, "pareto-frontier")


def fig_agent_pipeline() -> list[Path]:
    """LangGraph agent pipeline state machine with human checkpoints."""
    fig, ax = plt.subplots(figsize=(10, 3.2))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 3.5)
    ax.axis("off")
    ax.set_title("Agent pipeline state machine (LangGraph + LiteLLM)", fontsize=10, color=PRIMARY_DARK, pad=8)

    stages = [
        "Requirements",
        "Research",
        "Architect",
        "Cost",
        "Security",
        "Compliance",
        "IaC",
    ]
    xs = np.linspace(0.8, 12.8, len(stages))
    for i, (x, label) in enumerate(zip(xs, stages)):
        fc = PRIMARY if label == "Architect" else CARD
        ec = PRIMARY if label in ("Architect", "Security", "Compliance") else BORDER
        _rounded_box(ax, (x - 0.72, 1.55), 1.44, 0.85, label, fc=fc, ec=ec, fontsize=7.5)
        if i < len(stages) - 1:
            ax.annotate(
                "",
                xy=(xs[i + 1] - 0.75, 1.97),
                xytext=(x + 0.75, 1.97),
                arrowprops=dict(arrowstyle="-|>", color=PRIMARY_DARK, lw=1.3),
            )
            # Human checkpoint diamond
            cx = (x + xs[i + 1]) / 2
            ax.plot(cx, 1.15, marker="D", markersize=7, color=WARNING, markeredgecolor="white")
            ax.text(cx, 0.75, "Human\napprove", ha="center", fontsize=6, color=MUTED)

    _rounded_box(ax, (0.3, 2.55), 2.2, 0.55, r"Input: natural-language brief", fc="#EEF4FC", ec=PRIMARY, fontsize=7)
    _rounded_box(ax, (11.0, 2.55), 2.5, 0.55, r"Output: remediated CRG + IaC", fc="#E8F5EC", ec=SUCCESS, fontsize=7)

    # Planner loop annotation
    ax.annotate(
        r"Deterministic planner $\Pi$",
        xy=(xs[2], 1.55),
        xytext=(xs[2], 0.25),
        ha="center",
        fontsize=7,
        color=PRIMARY_DARK,
        arrowprops=dict(arrowstyle="-|>", color=PRIMARY, lw=1),
    )
    ax.text(7, 0.2, r"LLM proposal operator $\omega$ at each stage · gateway via LiteLLM", ha="center", fontsize=7, color=MUTED)
    return _save(fig, "agent-pipeline")


def fig_remediation_diff() -> list[Path]:
    """Before/after remediation graph diff with cost delta."""
    fig, axes = plt.subplots(1, 2, figsize=(9, 3.8), sharey=True)
    titles = ("Before remediation", "After remediation ($\\rho_{\\mathrm{RA}}$)")
    node_sets = [
        {"ALB": FAIL, "ECS": FAIL, "RDS": FAIL, "Secrets": FAIL},
        {"ALB": SUCCESS, "ECS": SUCCESS, "RDS": SUCCESS, "Secrets": SUCCESS},
    ]
    edges = [("ALB", "ECS"), ("ECS", "RDS"), ("ECS", "Secrets")]

    for ax, title, statuses in zip(axes, titles, node_sets):
        ax.set_title(title, fontsize=9, color=PRIMARY_DARK)
        G = nx.DiGraph()
        for n in statuses:
            G.add_node(n)
        for u, v in edges:
            G.add_edge(u, v)
        pos = {"ALB": (0, 1), "ECS": (1, 1), "RDS": (2, 1.3), "Secrets": (2, 0.7)}
        for n, c in statuses.items():
            nx.draw_networkx_nodes(G, pos, nodelist=[n], node_color=c, node_size=900, ax=ax, edgecolors="white", linewidths=1.2)
        nx.draw_networkx_labels(G, pos, font_size=8, font_color="white", font_weight="bold", ax=ax)
        for u, v in edges:
            ax.annotate("", xy=pos[v], xytext=pos[u], arrowprops=dict(arrowstyle="-|>", color=MUTED, lw=1.2, shrinkA=14, shrinkB=14))
        ax.axis("off")
        ax.set_xlim(-0.3, 2.5)
        ax.set_ylim(0.3, 1.7)

    fig.text(0.5, 0.02, r"$S_{\mathrm{ZT}}$: 37.5 → 100  ·  $\Delta C = +\$127$/mo (catalog-indexed, illustrative)", ha="center", fontsize=8, color=PRIMARY_DARK)
    return _save(fig, "remediation-diff")


def _three_tier_monthly() -> int:
    """Catalog cost for planner three-tier template (matches planner.py HA factors)."""
    ha = {"single": 1.0, "multi-az": 1.6, "multi-region": 2.4, "global": 3.0}
    items = [
        ("route53", 5, "global"),
        ("cloudfront", 35, "global"),
        ("alb", 22, "multi-az"),
        ("ecs", 90, "single"),
        ("rds", 140, "multi-az"),
        ("elasticache", 55, "multi-az"),
        ("s3", 25, "multi-region"),
    ]
    return round(sum(base * ha[mode] for _, base, mode in items))


def fig_provider_comparison() -> list[Path]:
    """Provider comparison bar chart (compareProviders logic from cost.ts)."""
    base = _three_tier_monthly()
    providers = [
        ("AWS", base, AWS, "Broadest catalog"),
        ("Azure", round(base * 0.97), AZURE, "Enterprise hybrid"),
        ("GCP", round(base * 0.92), GCP, "Data + K8s price/perf"),
        ("Private", round(base * 0.58), PRIVATE, "Low unit cost, high ops"),
    ]
    labels = [p[0] for p in providers]
    values = [p[1] for p in providers]
    colors = [p[2] for p in providers]

    fig, ax = plt.subplots(figsize=(6.5, 4))
    bars = ax.bar(labels, values, color=colors, edgecolor="white", linewidth=1.2, width=0.62)
    ax.set_ylabel("Monthly cost (USD, catalog-indexed)")
    ax.set_title("Multi-cloud cost comparison (three-tier template)", fontsize=10, color=PRIMARY_DARK)
    ax.set_ylim(0, max(values) * 1.18)
    ax.grid(axis="y", alpha=0.25, linestyle="--")

    for bar, (_, val, _, note) in zip(bars, providers):
        delta = val - base
        delta_txt = "baseline" if delta == 0 else f"{delta:+d} vs AWS"
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 12, f"${val}", ha="center", fontsize=8, fontweight="bold")
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() / 2, note, ha="center", va="center", fontsize=6.5, color="white", fontweight="bold")

    ax.text(0.98, 0.02, "From compareProviders() indexing", transform=ax.transAxes, ha="right", fontsize=7, color=MUTED, style="italic")
    return _save(fig, "provider-comparison")


FIGURES = [
    fig_crg_schema_three_tier,
    fig_five_planes,
    fig_zt_evaluation,
    fig_pareto_frontier,
    fig_agent_pipeline,
    fig_remediation_diff,
    fig_provider_comparison,
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    created: list[Path] = []
    for fn in FIGURES:
        created.extend(fn())
    print(f"Generated {len(created)} files in {OUT}:")
    for p in sorted(created):
        print(f"  {p}")


if __name__ == "__main__":
    main()
