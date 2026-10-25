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
    ("shell.profile", "/settings/profile"), ("shell.runs", f"{G}/activity/runs"), ("shell.run", f"{G}/agents/runs?page=run%3A1aca082a-d13d-4972-b3cf-9d2b28d6671c"),
    ("shell.schedule", f"{G}/activity/schedules"), ("shell.activity.events", f"{G}/activity/events"),
    ("shell.events", f"{G}/activity/events?filter=changes"), ("shell.change", f"{G}/activity/changes/agent/a1"),
    ("shell.notifications.rule", f"{G}/activity/rules"), ("shell.notifications.channels", f"{G}/activity/channels"),
    ("shell.notifications", f"{G}/activity/inbox"), ("shell.activity.approvals", f"{G}/agents/approvals"),
    ("shell.activity", f"{G}/activity/runs"),
    ("shell", f"{G}/explorer"),
    ("datasets.catalogue", "/datasets/catalogue"), ("datasets.validation", "/datasets/validation"),
    ("datasets.standard", "/datasets/standards"), ("datasets.imports", "/datasets/imports"),
    ("datasets", "/datasets/catalogue/admin/accession-phenotypes"),
    ("modeller.global_model", f"{G}/modeller/global-model"), ("modeller.models", f"{G}/modeller/models"),
    ("modeller.model.type.constraint", f"{AR}/modeller/models/arabidopsis/accession"), ("modeller.model.history", f"{G}/modeller/models?model=m1&models_tab=history"),
    ("modeller.model", f"{G}/modeller/models/airroutes"), ("modeller.stitches", f"{G}/modeller/stitches"),
    ("modeller.worlds", f"{G}/modeller/worlds"), ("modeller.guardrails", f"{G}/modeller/guardrails"),
    ("modeller.rules", f"{G}/modeller/rules"), ("modeller.requests", f"{G}/modeller/requests"),
    ("modeller.settings", f"{G}/modeller/settings"), ("modeller.connect", "/graphs/new"), ("modeller.draft", f"{G}/modeller/models?model=m1"),
    ("explorer.sessions", f"{G}/explorer?history"), ("explorer.home", f"{G}/explorer"), ("explorer", f"{G}/explorer/routes-out-of-lhr"),
    ("projects.list", f"{AR}/projects"), ("projects.new", f"{AR}/projects"), ("projects.todo", f"{AR}/projects/todos"), ("projects.decisions", f"{AR}/projects/decisions"),
    ("projects.impact", f"{AR}/projects/gene-edited-field-trials"), ("projects", f"{AR}/projects/early-flowering-under-drought"),
    ("agents.runs.filtered", f"{G}/agents/runs?f.agent_id=757e8fc1-53a5-46a4-9a9b-36f6f24065ae&f.status=failed&f.since=30d&via=assistant"),
    ("agents.runs", f"{G}/agents/runs"),
    ("agents.run.overview", f"{G}/agents/runs?page=run%3A40b49f33-1ae2-46c8-9ea1-efe63474979a&tab=overview"),
    ("agents.run.many.overview", f"{G}/agents/runs?page=run%3A4b5f8f99-5572-4a16-b329-8474a789cee1&tab=overview"),
    ("agents.run.many", f"{G}/agents/runs?page=run%3A4b5f8f99-5572-4a16-b329-8474a789cee1&tab=agents&view=role"),
    ("agents.run.step", f"{G}/agents/runs?page=run%3A40b49f33-1ae2-46c8-9ea1-efe63474979a&tab=stages"),
    ("agents.run.assets", f"{G}/agents/runs?page=run%3A40b49f33-1ae2-46c8-9ea1-efe63474979a&tab=assets"),
    ("agents.run.touched", f"{G}/agents/runs?page=run%3A40b49f33-1ae2-46c8-9ea1-efe63474979a&tab=touched"),
    ("agents.run.rerun", f"{G}/agents/runs?page=run%3A1aca082a-d13d-4972-b3cf-9d2b28d6671c&rerun=1"),
    ("agents.run.approval", f"{G}/agents/runs?page=run%3A40b49f33-1ae2-46c8-9ea1-efe63474979a&tab=agents"),
    ("agents.run.ask", f"{G}/agents/runs?page=run%3A11970a9e-3208-435f-abe6-20d0d1f11c5d&tab=stages"),
    ("agents.run", f"{G}/agents/runs?page=run%3A40b49f33-1ae2-46c8-9ea1-efe63474979a&tab=agents"),
    ("agents.approvals.alerts", f"{G}/agents/approvals/alerts"),
    ("agents.approvals", f"{G}/agents/approvals"),
    ("agents.ledger.entry", f"{G}/agents/ledger"),
    ("agents.ledger.actor", f"{G}/agents/ledger/actor?actor=agent%3A757e8fc1-53a5-46a4-9a9b-36f6f24065ae&since=7d"),
    ("agents.ledger.record", f"{G}/agents/ledger/record?address=graph%2FAirport&since=30d"),
    ("agents.ledger.refusals", f"{G}/agents/ledger/refusals"),
    ("agents.ledger.export", f"{G}/agents/ledger/export"),
    ("agents.ledger", f"{G}/agents/ledger"),
    ("agents.agents.filtered", f"{G}/agents/agents?q=fare&f.ephemeral=shown"),
    ("agents.home", f"{G}/agents/home"), ("agents.open", f"{G}/agents/home"),
    ("agents.fleet.map.table", f"{G}/agents/fleet/map?console=table"),
    ("agents.fleet.map", f"{G}/agents/fleet/map"), ("agents.fleet.table", f"{G}/agents/fleet/table"),
    ("agents.fleet", f"{G}/agents/fleet"), ("agents.overview", f"{G}/agents/fleet"),
    ("agents.performance.skills", f"{G}/agents/performance/skills"),
    ("agents.performance.llms", f"{G}/agents/performance/llms"), ("agents.performance", f"{G}/agents/performance"),
    ("agents.functions.detail", f"{G}/agents/functions?page=function%3Agraph.read.query"),
    ("agents.functions.plans", f"{G}/agents/functions/plans"),
    ("agents.functions.template", f"{G}/agents/functions/templates"),
    ("agents.functions.plugins", f"{G}/agents/functions/plugins"),
    ("agents.functions.plugin", f"{G}/agents/functions/plugins?page=plugin%3Ainvana.tools.mail"),
    ("agents.functions", f"{G}/agents/functions"),
    ("agents.plans.detail", f"{G}/agents/functions/plans?page=plan_runs%3A0938814c-7522-42ec-acd2-2d52d3636a5a"),
    ("agents.plans", f"{G}/agents/functions/promoted"), ("agents.library", f"{G}/agents/functions/plans"),
    ("agents.plugins", f"{G}/agents/functions/plugins"),
    ("agents.connections.mcp", f"{G}/agents/connections/mcp"),
    ("agents.llms.endpoint", f"{G}/agents/llms/85a79982-172c-4649-a7eb-2d14c9406182"), ("agents.llms", f"{G}/agents/llms"),
    ("agents.agent.new", f"{G}/agents/agents?page=agent%3A7b1a7963-e9f9-4b1a-8ab0-65435956a245&tab=overview"),
    ("agents.agent.detail", f"{G}/agents/agents?page=agent%3A69421b19-5ab7-4012-a6b4-32ae86a73891&tab=overview"),
    ("agents.agent.runs", f"{G}/agents/agents?page=agent%3A69421b19-5ab7-4012-a6b4-32ae86a73891&tab=runs"),
    ("agents.agent.soul", f"{G}/agents/agents?page=agent%3A69421b19-5ab7-4012-a6b4-32ae86a73891&tab=soul"),
    ("agents.agent.model", f"{G}/agents/agents?page=agent%3A69421b19-5ab7-4012-a6b4-32ae86a73891&tab=model"),
    ("agents.agent.flow", f"{G}/agents/agents?page=agent%3A7b1a7963-e9f9-4b1a-8ab0-65435956a245&tab=flow"),
    ("agents.agent.access", f"{G}/agents/agents?page=agent%3A7b1a7963-e9f9-4b1a-8ab0-65435956a245&tab=access"),
    ("agents.agent.limits", f"{G}/agents/agents?page=agent%3A7b1a7963-e9f9-4b1a-8ab0-65435956a245&tab=limits"),
    ("agents.agent.deploy", f"{G}/agents/agents?page=agent%3A7b1a7963-e9f9-4b1a-8ab0-65435956a245&tab=deploy"),
    ("agents.agent.retire", f"{G}/agents/agents?page=agent%3A850f6a82-de3a-432c-a663-a5dcba4dc32a&tab=overview"),
    ("agents.agent.instructions", f"{G}/agents/agents?page=agent%3A69421b19-5ab7-4012-a6b4-32ae86a73891&tab=instructions"),
    ("agents.agent.history", f"{G}/agents/agents?page=agent%3A69421b19-5ab7-4012-a6b4-32ae86a73891&tab=history"),
    ("agents.agent.activity", f"{G}/agents/agents?page=agent%3A69421b19-5ab7-4012-a6b4-32ae86a73891&tab=runs"),
    ("agents.agent.thinking", f"{G}/agents/agents?page=agent%3A69421b19-5ab7-4012-a6b4-32ae86a73891&tab=model"),
    ("agents.agent.skills", f"{G}/agents/agents?page=agent%3A69421b19-5ab7-4012-a6b4-32ae86a73891&tab=overview"),
    ("agents.agent.envelope", f"{G}/agents/agents?page=agent%3A69421b19-5ab7-4012-a6b4-32ae86a73891&tab=limits"),
    ("agents.agent.pause", f"{G}/agents/agents?page=agent%3A69421b19-5ab7-4012-a6b4-32ae86a73891&tab=overview"),
    ("agents.skill.new", f"{G}/agents/skills"),
    ("agents.skill.draft", f"{G}/agents/skills?page=skill%3A26ca4dad-e2bf-468e-a835-439e039b297e&tab=instructions"),
    ("agents.skill.unmapped", f"{G}/agents/skills?page=skill%3A8afc2fcc-b566-48fb-b548-2d09aeb9c876&tab=instructions"),
    ("agents.skill.functions", f"{G}/agents/skills?page=skill%3A26ca4dad-e2bf-468e-a835-439e039b297e&tab=instructions"),
    ("agents.skill.test", f"{G}/agents/skills?page=skill%3A26ca4dad-e2bf-468e-a835-439e039b297e&tab=instructions"),
    ("agents.skill.flow.unmapped", f"{G}/agents/skills?page=skill%3A8afc2fcc-b566-48fb-b548-2d09aeb9c876&tab=flow"),
    ("agents.skill.flow", f"{G}/agents/skills?page=skill%3Acedcf4cc-2d11-4c21-8fd7-dc82d921444c&tab=flow"),
    ("agents.skill.exceptions", f"{G}/agents/skills?page=skill%3A4fda731c-3fa6-48f4-9546-21b8cb764973&tab=exceptions"),
    ("agents.skill.evals", f"{G}/agents/skills?page=skill%3A4fda731c-3fa6-48f4-9546-21b8cb764973&tab=evals"),
    ("agents.skill.agents", f"{G}/agents/skills?page=skill%3A4fda731c-3fa6-48f4-9546-21b8cb764973&tab=agents"),
    ("agents.skill.usage", f"{G}/agents/skills?page=skill%3A4fda731c-3fa6-48f4-9546-21b8cb764973&tab=usage"),
    ("agents.skill.locked", f"{G}/agents/skills?page=skill%3Acedcf4cc-2d11-4c21-8fd7-dc82d921444c&tab=instructions"),
    ("agents.agents", f"{G}/agents/agents"), ("agents.agent", f"{G}/agents/agents?page=agent%3A69421b19-5ab7-4012-a6b4-32ae86a73891"),
    ("agents.skills.detail", f"{G}/agents/skills?page=skill%3Acedcf4cc-2d11-4c21-8fd7-dc82d921444c"), ("agents.skills", f"{G}/agents/skills"),
    ("agents.settings", f"{G}/agents/settings"),
]


RUN = "the uuid stands for a served run (seed_f05.py prints it): Agents › Runs, open the newest served run"
TREE = "the uuid stands for the seeded run tree of eight agents (scripts/agents-build/seed_f05.py prints it)"
MANY = "the uuid stands for the seeded run of 700 agents (scripts/agents-build/seed_f05.py prints it)"
SESSION = "routes-out-of-lhr stands for a session id: ask “Which routes out of LHR grew last quarter?”"
DARK = "theme dark: user menu › Appearance › Dark"
DATASET = "dataset admin/accession-phenotypes (demos/arabidopsis/load.py publishes it)"
BRANCH = "on branch H1.1 · …via lower FLC (needs B05)"
AGENT = "the uuid stands for the Explorer agent: open any agent from Agents"
MODEL = "m1 stands for the AirRoutes model id: click AirRoutes on the models board"
SKILL = "the uuid stands for a published skill (Answer in natural language): open it from Skills"
RUN_SKILL = "the uuid stands for a bound skill that has run (Hey, on Coordinator): open it from Skills"
UNMAPPED_SKILL = "the uuid stands for a draft whose last draw left a line unmapped (Mail the route desk): open it from Skills"
DRAFT_SKILL = "the uuid stands for a draft skill (Weekly route check): open it from Skills"
DRAFT_AGENT = "the uuid stands for a draft agent with two bound skills (Route desk briefer): Agents › Drafts"
#: A product doc whose stories enter the map phase by phase, as agents-build-sessions.md builds them.
BUILT = {"agent-fabric": {"AF-26", "AF-02", "AF-01", "AF-17", "AF-19", "AF-20", "AF-23", "AF-25",
                         "AF-03", "AF-04", "AF-05", "AF-06", "AF-21", "AF-22",
                         "AF-07", "AF-08", "AF-09", "AF-13", "AF-14", "AF-16", "AF-24"}}
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
    "shell.activity.approvals": "every ask waiting on a person is Agents › Approvals",
    "shell.run.approval": "15 stands for a run waiting on approval: open it from Approvals (needs B08)",
    "shell.schedule.new": "New schedule",
    "shell.schedule.detail": "click a schedule: /activity/schedules/<id>",
    "shell.change.compare": "a1 stands for an agent id with two versions: on its change row, Compare",
    "shell.notifications.rules": "",
    "shell.notifications.rule": "click a rule, or ?new=1 for New rule",
    "shell.notifications.channels": "",
    "shell.run.rerun": f"{RUN} that answered a question or a query; Re-run… on its header",
    "shell.first_run": "an install with no Graph yet",
    "agents.plans.detail": "the uuid stands for the newest nl-single flow's id: Functions › Packaged plans, click nl-single; its page opens as a tab after Functions",
    "agents.llms.endpoint": "the uuid stands for an endpoint's id: open any endpoint card; its modal opens in the path",
    "agents.skill.locked": f"{SKILL}, signed in as e2e-viewer (a viewer on the Graph; e2e/roles-agents.spec.ts makes the account, its password is in e2e/members.ts)",
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
    "datasets.standards.import": "Import from SKOS › File: demos/arabidopsis/semantic/plant-traits.skos.ttl (the preview)",
    "datasets.imports.run": "click an import while it runs: re-run demos/arabidopsis/load.py and open its run",
    "modeller.global_model.dark": DARK,
    "modeller.model.type": "click node type airport",
    "modeller.global_model.stitch": "click a dashed stitch on the board",
    "modeller.connect": "New Graph",
    "modeller.draft": f"{MODEL}, with an unpublished draft: change any property, do not publish",
    "modeller.global_model.diff": "with a draft on airroutes, Compare",
    "modeller.draft.publish": f"{MODEL}, on the draft: Publish",
    "modeller.draft.migration": f"{MODEL}, a breaking draft (remove a property): Publish",
    "modeller.models.new": "New model",
    "modeller.models.new.ontology": "More actions › From an ontology › File: demos/arabidopsis/semantic/schema-org-subset.ttl; tick Person, Organization, Product",
    "modeller.models.new.ontology.preview": "the same, then Preview",
    "modeller.models.overview": "Overview tab",
    "modeller.models.database": "Database tab",
    "modeller.models.usage": "Usage tab",
    "modeller.models.performance": "Performance tab",
    "modeller.models.growth": "Growth tab",
    "modeller.models.report": "open a saved report",
    "modeller.model.type.constraint": "Constraints tab; click days_to_flowering",
    "modeller.model.history": MODEL,
    "modeller.worlds.board": "click a world",
    "modeller.guardrails.request": "a request from Explorer that meets a guardrail: open it",
    "modeller.guardrails.edit": "click a guardrail rule",
    "modeller.rules.edit": "click a rule",
    "modeller.settings.database": "Database tab (?tab=graph)",
    "modeller.settings.members": "Members tab (?tab=members)",
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
    "explorer.answer.share": f"{SESSION}; Share on the reply line, beside Add to a project",
    "explorer.answer.console": f"{SESSION}; open the Console",
    "projects.new": "Projects › New project",
    "projects.project.branches": "Branches tab (needs B05)",
    "projects.branch.fork": "Branches tab › Fork a branch on H1 (needs B05)",
    "projects.branch": BRANCH,
    "projects.finding": f"{BRANCH}; click “Col-0 carries a loss-of-function FRI allele”",
    "projects.branch.decide": f"{BRANCH}; Decide",
    "projects.branch.merge": f"{BRANCH}; Merge…",
    "projects.simulate": "on branch H2, Simulate (needs a simulator and a dataset cite on H2)",
    "projects.simulate.result": "on branch H2, Simulate › Run simulation; or its Simulations tab › s1",
    "projects.impact": "Impact tab (needs a finding that cites a graph record)",
    "projects.lineage": "Lineage tab (needs B05)",
    "projects.todo": "click “Score days to flowering on trays 11–18”",
    "projects.decisions": "needs B05 for its rows",
    "projects.report": "Report tab (needs B05)",
    "agents.overview.dark": DARK,
    "agents.agents.lineage": "Lineage tab",
    "agents.run.overview": f"{TREE}; Overview tab",
    "agents.run.many.overview": f"{MANY}; Overview tab — the large-run reading",
    "agents.run.many.icicle": f"{MANY}; Agents › By role — the icicle is not built (the-run-page.md Not building)",
    "agents.run.many": f"{MANY}; Agents tab, By role",
    "agents.run.step": f"{TREE}; Stages tab, click the first stage",
    "agents.run.assets": f"{TREE}; Assets tab",
    "agents.run.touched": f"{TREE}; Data touched tab",
    "agents.run.rerun": "the uuid stands for a served run of Route Auditor; Rerun",
    "agents.run.closed": f"{TREE}; Agents tab, the assistant closed",
    "agents.run.approval": f"{TREE}; Agents — the delegation ask drawn on the tree (the assistant's proposal card needs a live session)",
    "agents.run.ask": "the uuid stands for an Explorer answer's run (a served run with a session); Stages tab, click a stage",
    "agents.run": f"{TREE}; Agents tab, Tree",
    "agents.approvals.alerts": "Alert rules tab — five seeded rules",
    "agents.ledger.entry": "Rows tab, click the first row (opens ?row=)",
    "agents.ledger.actor": "the uuid stands for Route Auditor",
    "agents.ledger.member": "signed in as e2e-viewer (INVANA_MIGRATION_USER=e2e-viewer INVANA_MIGRATION_PASSWORD=e2e-member-password-1)",
    "agents.runs.filtered": "Route Auditor's failed runs this month, as the assistant links them — the uuid stands for Route Auditor (seed_f05.py)",
    "agents.agents.filtered": "Agents searched for fare with spawned helpers shown",
    "agents.functions.detail": "graph.read.query stands for a function's dotted name: click any function in Functions",
    "agents.functions.plans": "Packaged plans tab",
    "agents.functions.closed": "Functions with the assistant closed",
    "agents.functions.templates": "Templates tab",
    "agents.functions.template.new": "Templates tab › New template",
    "agents.functions.plugins": "Plugins tab",
    "agents.plans.detail": "nl-single stands for a plan's flows.id: Packaged plans, click a plan",
    "agents.plans.promote": "Functions › Promote a plan",
    "agents.open": "click + on the tab strip: the palette lists the sections and recent records",
    "agents.fleet.overview": "Overview tab",
    "agents.fleet.overview.empty": "a Graph no agent has run on: Overview tab",
    "agents.fleet.map.closed": "Map tab with the assistant closed",
    "agents.fleet.map.agent": "Map tab, click an agent",
    "agents.fleet.map.table": "Map tab with the console open on its Table (`?console=table`)",
    "agents.performance.skills": "Skills tab",
    "agents.performance.llms": "LLMs tab",
    "agents.llms.endpoint": "anthropic stands for an endpoint's id: click an endpoint's Open",
    "agents.llms.add": "Add endpoint",
    "agents.connections.mcp": "MCP servers tab",
    "agents.connections.mcp.add": "MCP servers › Add MCP server",
    "agents.agent": AGENT,
    "agents.agent.detail": f"{AGENT}; Overview tab (`?tab=overview`)",
    "agents.agent.runs": f"{AGENT}; Runs tab",
    "agents.agent.model": f"{AGENT}; Model tab",
    "agents.skill.new": "Skills › New skill opens an untitled draft on Instructions",
    "agents.skill.draft": f"{DRAFT_SKILL}; Instructions tab",
    "agents.skill.unmapped": f"{UNMAPPED_SKILL}; a line the draw could not map",
    "agents.skill.functions": f"{DRAFT_SKILL}; Add functions",
    "agents.skill.test": f"{DRAFT_SKILL}; the console under Instructions after Run a test",
    "agents.skill.flow": f"{SKILL}; Flow tab",
    "agents.skill.flow.step": f"{SKILL}; Flow tab, click a step",
    "agents.skill.flow.unmapped": f"{UNMAPPED_SKILL}; Flow tab with an unmapped line",
    "agents.skill.exceptions": f"{RUN_SKILL}; Exceptions tab",
    "agents.skill.evals": f"{RUN_SKILL}; Evals tab (four cases and one live eval run)",
    "agents.skill.agents": f"{RUN_SKILL}; Agents tab",
    "agents.skill.usage": f"{RUN_SKILL}; Usage tab",
    "agents.agent.activity": f"{AGENT}; Runs tab, where its activity folded",
    "agents.agent.instructions": f"{AGENT}; Instructions tab",
    "agents.agent.soul": f"{AGENT}; Soul tab",
    "agents.agent.thinking": f"{AGENT}; Model tab, where effort folded",
    "agents.agent.skills": f"{AGENT}; Overview, its Skills card",
    "agents.agent.envelope": f"{AGENT}; Limits tab, where the envelope folded",
    "agents.agent.history": f"{AGENT}; History tab",
    "agents.agent.pause": f"{AGENT}; Pause or Retire on the head",
    "agents.agent.new": f"{DRAFT_AGENT}; New agent opens a draft like it on its Overview, the builder",
    "agents.agent.flow": f"{DRAFT_AGENT}; Flow tab",
    "agents.agent.access": f"{DRAFT_AGENT}; Access tab",
    "agents.agent.limits": f"{DRAFT_AGENT}; Limits tab",
    "agents.agent.deploy": f"{DRAFT_AGENT}; Deploy tab",
    "agents.agent.retire": "the uuid stands for an agent a schedule starts (Coordinator): Retire on the head",
    "agents.functions.plugin": "invana.tools.mail, a tool plugin that is off: Functions › Plugins, click it",
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
    for doc in ["shell", "datasets", "modeller", "explorer", "projects", "agents", "agent-fabric"]:
        for m in re.finditer(r"^\| ([A-Z]{2}-\d{2}) \|(.*)$", (DOCS / f"{doc}.md").read_text(), re.M):
            if doc in BUILT and m.group(1) not in BUILT[doc]:
                continue
            for b in re.findall(r"`([a-z_.]+)`", m.group(2)):
                variant = b.split(".")[-1] in {"dark", "readonly", "error", "closed"} or b.count(".") > 2
                route = route_for(b)
                if route is None or (variant and b not in STATE):
                    missing.append(b)
                if (route and b.startswith("agents.") and not b.endswith(".closed")
                        and b not in {"agents.home", "agents.open"}):
                    # The Agents boards draw the assistant docked; `.closed` boards draw it closed,
                    # and Home's composer is the assistant before a thread exists.
                    route += ("&" if "?" in route else "?") + "right=assistant"
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
