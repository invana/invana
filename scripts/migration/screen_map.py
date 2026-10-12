#!/usr/bin/env python3
"""Generate screen-map.json — every prototype board, its story, and the route that draws it in Studio.

The stories come from the tables in docs/products/<product>.md (the same tables the
prototype's build checks). Routes follow docs/products/migration-plan.md §5. ``state``
says how to reach a board that is not simply its route's landing view — the tab, dialog,
selection, theme or data it needs, and the engine session a board waits on. It lives in
``STATE`` below, so regenerating never loses it.

Data: ``/u/admin/airways`` is demos/airways; ``/u/admin/arabidopsis`` and the accession-phenotypes
dataset are demos/arabidopsis (``demos/arabidopsis/load.py``). A route segment that stands for an
id (``15``, ``routes-out-of-lhr``, ``analyst``, ``answer-nl``) is named in its board's state.

Exits non-zero when a board has no route, or is a variant with no state.

Run: python3 scripts/migration/screen_map.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "products"
G = "/u/admin/airways"
AR = "/u/admin/arabidopsis"
ROUTES = [  # first match wins: (board prefix, route template)
    ("shell.login", "/login"), ("shell.graphs", "/graphs"), ("shell.first_run", "/graphs?first-run"),
    ("shell.profile", "/settings/profile"), ("shell.runs", f"{G}/activity/runs"), ("shell.run", f"{G}/activity/runs/15"),
    ("shell.schedule", f"{G}/activity/schedules"), ("shell.activity.events", f"{G}/activity/events"),
    ("shell.events", f"{G}/activity/events?filter=changes"), ("shell.change", f"{G}/activity/events?filter=changes"),
    ("shell.notifications", f"{G}/activity/inbox"), ("shell.activity", f"{G}/activity/runs"),
    ("shell", f"{G}/explorer"),
    ("datasets.catalogue", "/datasets/catalogue"), ("datasets.validation", "/datasets/validation"),
    ("datasets.standard", "/datasets/standards"), ("datasets.imports", "/datasets/imports"),
    ("datasets", "/datasets/catalogue/admin/accession-phenotypes"),
    ("modeller.global_model", f"{G}/modeller/global-model"), ("modeller.models", f"{G}/modeller/models"),
    ("modeller.model.type.constraint", f"{AR}/modeller/models/arabidopsis/accession"), ("modeller.model.history", f"{AR}/modeller/models/arabidopsis?tab=history"),
    ("modeller.model", f"{G}/modeller/models/airroutes"), ("modeller.stitches", f"{G}/modeller/stitches"),
    ("modeller.worlds", f"{G}/modeller/worlds"), ("modeller.guardrails", f"{G}/modeller/guardrails"),
    ("modeller.rules", f"{G}/modeller/rules"), ("modeller.requests", f"{G}/modeller/requests"),
    ("modeller.settings", f"{G}/modeller/settings"), ("modeller.connect", "/graphs/new"), ("modeller.draft", f"{G}/modeller/models/airroutes?draft"),
    ("explorer.sessions", f"{G}/explorer?history"), ("explorer.home", f"{G}/explorer"), ("explorer", f"{G}/explorer/routes-out-of-lhr"),
    ("projects.list", f"{AR}/projects"), ("projects.new", f"{AR}/projects"), ("projects.todo", f"{AR}/projects/todos"), ("projects.decisions", f"{AR}/projects/decisions"),
    ("projects.impact", f"{AR}/projects/gene-edited-field-trials"), ("projects", f"{AR}/projects/early-flowering-under-drought"),
    ("agents.overview", f"{G}/agents"), ("agents.agents", f"{G}/agents/agents"), ("agents.agent", f"{G}/agents/agents/analyst"),
    ("agents.skills.detail", f"{G}/agents/skills/answer-nl"), ("agents.skills", f"{G}/agents/skills"),
    ("agents.library", f"{G}/agents/library"), ("agents.plugins", f"{G}/agents/plugins"), ("agents.llms", f"{G}/agents/llms"),
    ("agents.performance", f"{G}/agents/performance"), ("agents.settings", f"{G}/agents/settings"),
]


RUN = "15 stands for a run id: Activity › Runs, open the newest succeeded run"
SESSION = "routes-out-of-lhr stands for a session id: ask “Which routes out of LHR grew last quarter?”"
DARK = "theme dark: user menu › Appearance › Dark"
DATASET = "dataset admin/accession-phenotypes (demos/arabidopsis/load.py publishes it)"
BRANCH = "on branch H1.1 · …via lower FLC (needs B05)"
AGENT = "analyst stands for an agent's slug: open any agent from Agents"
SKILL = "answer-nl stands for a skill's slug: open any skill from Skills"
STATE = {  # board → how to reach it from its route; a board absent here is its route's landing view
    "shell.onboarding": "a Graph whose set-up is not finished: the set-up checklist open",
    "shell.launcher.open": "click the product launcher in the header",
    "shell.breadcrumbs.overflow": f"open a finding {BRANCH}: /u/admin/arabidopsis/projects/early-flowering-under-drought › H1.1 › a finding",
    "shell.command_palette": "press ⌘K",
    "shell.user_menu": "open the user menu, header right",
    "shell.runs": "open the kind, status and product filters",
    "shell.run.overview": f"{RUN}; Overview tab",
    "shell.run.touched": f"{RUN}; Touched tab",
    "shell.run.log": f"{RUN}; Log tab",
    "shell.run.step": f"{RUN}; click a step on its timeline",
    "shell.run.failed": "15 stands for a failed run's id: Activity › Runs, status failed, open the newest",
    "shell.run.compare": "two runs of one question in two worlds: select both in Activity › Runs, Compare",
    "shell.activity.approvals": "Approvals tab",
    "shell.run.approval": "15 stands for a run waiting on approval: open it from Approvals (needs B08)",
    "shell.schedule.new": "New schedule",
    "shell.schedule.detail": "click a schedule",
    "shell.change.compare": "on a change row, Compare (needs B01)",
    "shell.notifications.rules": "Rules tab (needs B08)",
    "shell.notifications.rule": "Rules tab, click a rule (needs B08)",
    "shell.notifications.channels": "Channels tab (needs B08)",
    "shell.run.rerun": f"{RUN}; Re-run (needs B02)",
    "shell.first_run": "an install with no Graph yet",
    "agents.skills.detail.readonly": f"{SKILL}, signed in as a member without the Agents role (needs B11)",
    "shell.profile.tokens": "Access tokens tab",
    "datasets.dataset": DATASET,
    "datasets.dataset.provenance": f"{DATASET}; Provenance tab",
    "datasets.dataset.versions": f"{DATASET}; Versions tab",
    "datasets.dataset.used": f"{DATASET}; Used by tab",
    "datasets.record": f"{DATASET}; click Col-0 in the preview",
    "datasets.observe": f"{DATASET}; Add observations",
    "datasets.observe.assistant": f"{DATASET}; Add observations › tell the assistant",
    "datasets.collect": "Catalogue › Collect with an agent (needs B06b)",
    "datasets.collect.run": "a collection while it runs (needs B06b)",
    "datasets.validation.item": "a standard violation: attach a standard to a dataset in warn, then click a row of the queue",
    "datasets.standard": "click a standard in the library",
    "datasets.standard.attach": "on a standard, Attach to a dataset",
    "datasets.dataset.conformance": f"{DATASET}; Conformance tab",
    "datasets.documents": "not built — no documents dataset in the engine",
    "datasets.bind": f"{DATASET}; Bind to a Graph › arabidopsis",
    "datasets.share": f"{DATASET}; Share",
    "datasets.dataset.retracted": f"{DATASET}; a version marked retracted",
    "datasets.standards.import": "Import › From SKOS (needs B12)",
    "datasets.imports.run": "click an import while it runs: re-run demos/arabidopsis/load.py and open its run",
    "modeller.global_model.dark": DARK,
    "modeller.model.type": "click node type airport",
    "modeller.global_model.stitch": "click a dashed stitch on the board",
    "modeller.connect": "New Graph",
    "modeller.draft": "airroutes with an unpublished draft: change any property, do not publish",
    "modeller.global_model.diff": "with a draft on airroutes, Compare",
    "modeller.draft.publish": "on the draft, Publish",
    "modeller.draft.migration": "a breaking draft (narrow an enum), Publish (needs B10)",
    "modeller.models.new": "New model",
    "modeller.models.new.ontology": "New model › From an ontology (needs B12)",
    "modeller.models.new.ontology.preview": "New model › From an ontology › pick types › Preview (needs B12)",
    "modeller.models.overview": "Overview tab",
    "modeller.models.database": "Database tab",
    "modeller.models.usage": "Usage tab",
    "modeller.models.performance": "Performance tab",
    "modeller.models.growth": "Growth tab",
    "modeller.models.report": "open a saved report",
    "modeller.model.type.constraint": "Constraints tab; click days_to_flowering",
    "modeller.model.history": "one version until B01 records more",
    "modeller.worlds.board": "click a world",
    "modeller.guardrails.request": "a request from Explorer that meets a guardrail: open it",
    "modeller.guardrails.edit": "click a guardrail rule",
    "modeller.rules.edit": "click a rule",
    "modeller.settings.database": "Database tab",
    "modeller.settings.members": "Members tab",
    "explorer.home": "a new session: empty board, nothing asked",
    "explorer.answer": SESSION,
    "explorer.answer.node": f"{SESSION}; click a node on the board",
    "explorer.answer.dark": f"{SESSION}; {DARK}",
    "explorer.answer.chart": "ask “Routes out of LHR by carrier, as a bar chart”",
    "explorer.answer.trace": f"{SESSION}; How I got this",
    "explorer.answer.cannot": "ask something the graph holds nothing on, e.g. “What did a ticket to JFK cost?”",
    "explorer.answer.guardrail": "in the Price-blind world, ask for deals by revenue",
    "explorer.answer.schedule": f"{SESSION}; Schedule this",
    "explorer.answer.scheduled": f"{SESSION}; Schedule this › confirm",
    "explorer.answer.query": f"{SESSION}; composer Cypher, run MATCH (a:airport {{code:'LHR'}})-[:route]->(b) RETURN a,b LIMIT 25",
    "explorer.answer.query.error": f"{SESSION}; composer Cypher, run a query with a syntax error",
    "explorer.tools": f"{SESSION}; toolbar expanded",
    "explorer.tools.expand": f"{SESSION}; on a node, Expand neighbours",
    "explorer.tools.styling": f"{SESSION}; Styling and layers",
    "explorer.tools.history": f"{SESSION}; Canvas history",
    "explorer.locked": "a Graph whose set-up is not finished",
    "explorer.answer.to_project": f"{SESSION}; Add to a project (needs C02)",
    "explorer.answer.closed": f"{SESSION}; close the chat with ✕",
    "explorer.answer.share": f"{SESSION}; Share",
    "explorer.answer.console": f"{SESSION}; open the Console",
    "projects.new": "Projects › New project",
    "projects.project.branches": "Branches tab (needs B05)",
    "projects.branch.fork": "Branches tab › Fork a branch on H1 (needs B05)",
    "projects.branch": BRANCH,
    "projects.finding": f"{BRANCH}; click “Col-0 carries a loss-of-function FRI allele”",
    "projects.branch.decide": f"{BRANCH}; Decide",
    "projects.branch.merge": f"{BRANCH}; Merge…",
    "projects.simulate": "on branch H2, Simulate crosses (needs B09)",
    "projects.simulate.result": "on branch H2, Simulate crosses › Run 4 crosses (needs B09)",
    "projects.impact": "Impact tab (needs B05)",
    "projects.lineage": "Lineage tab (needs B05)",
    "projects.todo": "click “Score days to flowering on trays 11–18”",
    "projects.decisions": "needs B05 for its rows",
    "projects.report": "Report tab (needs B05)",
    "agents.overview.dark": DARK,
    "agents.agents.lineage": "Lineage tab",
    "agents.agent": AGENT,
    "agents.agent.activity": f"{AGENT}; Activity tab",
    "agents.agent.instructions": f"{AGENT}; Instructions tab (needs B02)",
    "agents.agent.soul": f"{AGENT}; Soul tab",
    "agents.agent.thinking": f"{AGENT}; Thinking tab",
    "agents.agent.skills": f"{AGENT}; Skills & callables tab",
    "agents.agent.envelope": f"{AGENT}; Envelope",
    "agents.agent.history": f"{AGENT}; History tab",
    "agents.agent.pause": f"{AGENT}; Pause or retire",
    "agents.skills.detail": SKILL,
    "agents.skills.instructions.edit": f"{SKILL}; Edit instructions (needs B02)",
    "agents.skills.evals": f"{SKILL}; Evals tab (needs B02)",
    "agents.skills.plan.regenerated": f"{SKILL}; save an instructions edit (needs B02)",
    "agents.skills.history": f"{SKILL}; History tab",
    "agents.skills.usage": f"{SKILL}; Usage tab",
    "agents.library.plan": "Plans tab, click a plan",
    "agents.library.plan.overview": "Plans tab, click a plan; Overview tab",
    "agents.library.plan.revisions": "a run that replanned: its Revisions",
    "agents.library.templates": "Templates tab",
    "agents.plugins": "needs B06a for its rows",
    "agents.plugins.plugin": "click a plugin (needs B06a)",
    "agents.plugins.task": "click a plugin, then a task type (needs B06a)",
}


def route_for(board: str) -> str | None:
    return next((r for p, r in ROUTES if board == p or board.startswith(p + ".") or board.startswith(p)), None)


def main() -> None:
    boards, missing = {}, []
    for doc in ["shell", "datasets", "modeller", "explorer", "projects", "agents"]:
        for m in re.finditer(r"^\| ([A-Z]{2}-\d{2}) \|(.*)$", (DOCS / f"{doc}.md").read_text(), re.M):
            for b in re.findall(r"`([a-z_.]+)`", m.group(2)):
                variant = b.split(".")[-1] in {"dark", "readonly", "error", "closed"} or b.count(".") > 2
                route = route_for(b)
                if route is None or (variant and b not in STATE):
                    missing.append(b)
                boards[b] = {"story": m.group(1), "product": doc, "route": route, "state": STATE.get(b, "")}
    (ROOT / "scripts" / "migration" / "screen-map.json").write_text(json.dumps({"boards": boards}, indent=1))
    stale = sorted(set(STATE) - set(boards))
    print(len(boards), "boards mapped,", sum(1 for b in boards.values() if b["state"]), "with state")
    if stale:
        print("state for boards no doc names:", ", ".join(stale))
    if missing:
        sys.exit("no route or no state: " + ", ".join(missing))


if __name__ == "__main__":
    main()
