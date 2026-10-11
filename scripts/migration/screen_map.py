#!/usr/bin/env python3
"""Generate screen-map.json — every prototype board, its story, and the route that draws it in Studio.

The stories come from the tables in docs/products/<product>.md (the same tables the
prototype's build checks). Routes follow docs/products/migration-plan.md §5. A route
marked ``state`` needs data or an open dialog that the reviewer sets up by hand;
the R00 session fills those in.

Run: python3 scripts/migration/screen_map.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "products"
G = "/u/admin/airways"
CK = "/u/admin/chickpea"
ROUTES = [  # first match wins: (board prefix, route template)
    ("shell.login", "/login"), ("shell.graphs", "/graphs"), ("shell.first_run", "/graphs?first-run"),
    ("shell.profile", "/settings/profile"), ("shell.run", f"{G}/activity/runs/15"), ("shell.runs", f"{G}/activity/runs"),
    ("shell.schedule", f"{G}/activity/schedules"), ("shell.activity.events", f"{G}/activity/events"),
    ("shell.events", f"{G}/activity/events?filter=changes"), ("shell.change", f"{G}/activity/events?filter=changes"),
    ("shell.notifications", f"{G}/activity/inbox"), ("shell.activity", f"{G}/activity/runs"),
    ("shell", f"{G}/explorer"),
    ("datasets.catalogue", "/datasets/catalogue"), ("datasets.validation", "/datasets/validation"),
    ("datasets.standard", "/datasets/standards"), ("datasets.imports", "/datasets/imports"),
    ("datasets", "/datasets/catalogue/variety-attributes"),
    ("modeller.global_model", f"{G}/modeller/global-model"), ("modeller.models", f"{G}/modeller/models"),
    ("modeller.model.type.constraint", f"{CK}/modeller/models/chickpea/variety"), ("modeller.model.history", f"{CK}/modeller/models/chickpea?tab=history"),
    ("modeller.model", f"{G}/modeller/models/airroutes"), ("modeller.stitches", f"{G}/modeller/stitches"),
    ("modeller.worlds", f"{G}/modeller/worlds"), ("modeller.guardrails", f"{G}/modeller/guardrails"),
    ("modeller.rules", f"{G}/modeller/rules"), ("modeller.requests", f"{G}/modeller/requests"),
    ("modeller.settings", f"{G}/modeller/settings"), ("modeller.connect", "/graphs/new"), ("modeller.draft", f"{G}/modeller/models/airroutes?draft"),
    ("explorer.sessions", f"{G}/explorer?history"), ("explorer.home", f"{G}/explorer"), ("explorer", f"{G}/explorer/routes-out-of-lhr"),
    ("projects.list", f"{CK}/projects"), ("projects.todo", f"{CK}/projects/todos"), ("projects.decisions", f"{CK}/projects/decisions"),
    ("projects.impact", f"{CK}/projects/support-price"), ("projects", f"{CK}/projects/drought-tolerant-chickpea"),
    ("agents.overview", f"{G}/agents"), ("agents.agents", f"{G}/agents/agents"), ("agents.agent", f"{G}/agents/agents/analyst"),
    ("agents.skills.detail", f"{G}/agents/skills/answer-nl"), ("agents.skills", f"{G}/agents/skills"),
    ("agents.library", f"{G}/agents/library"), ("agents.plugins", f"{G}/agents/plugins"), ("agents.llms", f"{G}/agents/llms"),
    ("agents.performance", f"{G}/agents/performance"), ("agents.settings", f"{G}/agents/settings"),
]


def route_for(board: str) -> str:
    return next(r for p, r in ROUTES if board == p or board.startswith(p + ".") or board.startswith(p))


def main() -> None:
    boards = {}
    for doc in ["shell", "datasets", "modeller", "explorer", "projects", "agents"]:
        for m in re.finditer(r"^\| ([A-Z]{2}-\d{2}) \|(.*)$", (DOCS / f"{doc}.md").read_text(), re.M):
            for b in re.findall(r"`([a-z_.]+)`", m.group(2)):
                variant = b.split(".")[-1] in {"dark", "readonly", "error", "closed"} or b.count(".") > 2
                boards[b] = {"story": m.group(1), "product": doc, "route": route_for(b),
                             "state": "set up by hand (dialog, variant or data)" if variant else ""}
    (ROOT / "scripts" / "migration" / "screen-map.json").write_text(json.dumps({"boards": boards}, indent=1))
    print(len(boards), "boards mapped")


if __name__ == "__main__":
    main()
