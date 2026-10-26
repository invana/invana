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
AIRROUTES = "d5b061e6-e75b-4545-8cbc-23f316331004"  # airways' AirRoutes model, which holds a draft
ARABIDOPSIS = "807b30c5-7b5a-4eab-b954-684441467763"  # arabidopsis' only model
DEALS = "c83c82d2-2eba-40d0-9e95-c3ff62c588e8"  # airways' Deals model, whose draft drops a property
EU_WORLD = "51356733-0529-43d7-b862-701efbcf6c62"  # airways' world "EU · H1 2026"
MODELS_REPORT = "dce818ce-45ca-4f04-998f-89e6129a10a1"  # airways' saved report "Models overview, 30 days"
ROUTES = [  # first match wins: (board prefix, route template)
    ("shell.login", "/login"), ("shell.graphs", "/graphs"), ("shell.first_run", "/graphs?first-run"),
    ("shell.profile", "/settings/profile"), ("shell.runs", f"{G}/activity/runs"), ("shell.run", f"{G}/agents/runs?page=run%3Aeaec1323-ac75-466b-a616-86b031fbeacb"),
    ("shell.schedule", f"{G}/activity/schedules"), ("shell.activity.events", f"{G}/activity/events"),
    ("shell.events", f"{G}/activity/events?filter=changes"), ("shell.change", f"{G}/activity/changes/agent/a1"),
    ("shell.notifications.rule", f"{G}/activity/rules"), ("shell.notifications.channels", f"{G}/activity/channels"),
    ("shell.notifications", f"{G}/activity/inbox"), ("shell.activity.approvals", f"{G}/agents/approvals"),
    ("shell.activity", f"{G}/activity/runs"),
    ("shell", f"{G}/explorer"),
    ("iam.home", f"{G}/iam/home"), ("iam.people", f"{G}/iam/people"), ("iam.groups", f"{G}/iam/groups"),
    ("iam.agents", f"{G}/iam/agents"), ("iam.agent.effective", f"{G}/iam/agents?page=iam_agent%3A850f6a82-de3a-432c-a663-a5dcba4dc32a"),
    ("iam.policies.denied", f"{G}/iam/policies?dialog=new"), ("iam.policies", f"{G}/iam/policies"),
    ("iam.policy.statements", f"{G}/iam/policies?page=policy%3Afare-team-quota&tab=statements"),
    ("iam.policy.limits", f"{G}/iam/policies?page=policy%3Afare-team-quota&tab=limits"),
    ("iam.policy.held_by", f"{G}/iam/policies?page=policy%3Afare-team-quota&tab=held_by"),
    ("iam.policy.test", f"{G}/iam/policies?page=policy%3Afare-team-quota&dialog=test"
     "&who=agent%3A24e2b9d6-384b-49de-b339-51f31dbc85d1&by=7332bf02-9180-42e0-8462-32b1e6f1d2a7"
     "&does=graph.write.records&to=graph%2FFare%2FLHR-JFK%20%C2%B7%20price"),
    ("iam.policy.draft", f"{G}/iam/policies?page=policy%3Aagent-readers"),
    ("iam.policy.impact", f"{G}/iam/policies?page=policy%3Aagent-readers&dialog=impact"),
    ("iam.tokens.new", f"{G}/iam/tokens?new=1"), ("iam.tokens", f"{G}/iam/tokens"),
    ("datasets.catalogue", "/datasets/catalogue"), ("datasets.validation", "/datasets/validation"),
    ("datasets.standard", "/datasets/standards"), ("datasets.imports", "/datasets/imports"),
    ("datasets", "/datasets/catalogue/admin/accession-phenotypes"),
    ("modeller.global_model", f"{G}/modeller/global-model"),
    *[(f"modeller.models.{t}", f"{G}/modeller/models?models_tab={t}")
      for t in ("overview", "database", "usage", "performance", "growth")],
    ("modeller.models.report", f"{G}/modeller/models?page=models%3Aairways%40{MODELS_REPORT}"),
    ("modeller.models", f"{G}/modeller/models"),
    ("modeller.model.type.constraint", f"{G}/modeller/models?model={AIRROUTES}&model_open=1&model_type=airport&type_tab=constraints"),
    ("modeller.model.history", f"{G}/modeller/models?model={AIRROUTES}&model_open=1&models_tab=history"),
    ("modeller.model.type", f"{G}/modeller/models?model={AIRROUTES}&model_open=1&model_type=airport"),
    ("modeller.model", f"{G}/modeller/models?model={AIRROUTES}&model_open=1"),
    ("modeller.stitches", f"{G}/modeller/stitches"),
    ("modeller.worlds.board", f"{G}/modeller/worlds/{EU_WORLD}?page=world:{EU_WORLD}"),
    ("modeller.worlds", f"{G}/modeller/worlds/{EU_WORLD}"),
    ("modeller.guardrails", f"{G}/modeller/guardrails"),
    ("modeller.rules", f"{G}/modeller/rules"), ("modeller.requests", f"{G}/modeller/requests"),
    ("modeller.settings.database", f"{G}/modeller/settings?tab=graph"),
    ("modeller.settings.members", f"{G}/modeller/settings?tab=members"),
    ("modeller.settings", f"{G}/modeller/settings?tab=basic"), ("modeller.connect", "/graphs/new"),
    ("modeller.draft.migration", f"{G}/modeller/models?model={DEALS}&model_open=1&models_view=schema"),
    ("modeller.draft", f"{G}/modeller/models?model={AIRROUTES}&model_open=1&models_view=schema"),
    ("explorer.sessions", f"{G}/explorer?history"), ("explorer.home", f"{G}/explorer"), ("explorer", f"{G}/explorer/routes-out-of-lhr"),
    ("projects.list", f"{AR}/projects"), ("projects.new", f"{AR}/projects"), ("projects.todo", f"{AR}/projects/todos"), ("projects.decisions", f"{AR}/projects/decisions"),
    ("projects.impact", f"{AR}/projects/gene-edited-field-trials"), ("projects", f"{AR}/projects/early-flowering-under-drought"),
    ("agents.runs.filtered", f"{G}/agents/runs?f.agent_id=757e8fc1-53a5-46a4-9a9b-36f6f24065ae&f.exit_reason=not_served&f.since=30d&via=assistant"),
    ("agents.runs", f"{G}/agents/runs"),
    ("agents.run.overview", f"{G}/agents/runs?page=run%3A5e913a26-1874-4299-bd12-66bac6c3ecb6&tab=overview"),
    ("agents.run.many.overview", f"{G}/agents/runs?page=run%3Ae8f2bc27-c5d4-4d38-b72c-dcc7f22c19ec&tab=overview"),
    ("agents.run.many", f"{G}/agents/runs?page=run%3Ae8f2bc27-c5d4-4d38-b72c-dcc7f22c19ec&tab=agents&view=role"),
    ("agents.run.step", f"{G}/agents/runs?page=run%3A5e913a26-1874-4299-bd12-66bac6c3ecb6&tab=stages&step=708c5569-c1bb-4ada-bf64-b09a0c7d7ccb"),
    ("agents.run.assets", f"{G}/agents/runs?page=run%3A5e913a26-1874-4299-bd12-66bac6c3ecb6&tab=assets"),
    ("agents.run.touched", f"{G}/agents/runs?page=run%3A5e913a26-1874-4299-bd12-66bac6c3ecb6&tab=touched"),
    ("agents.run.rerun", f"{G}/agents/runs?page=run%3Aeaec1323-ac75-466b-a616-86b031fbeacb&rerun=1"),
    ("agents.run.approval", f"{G}/agents/runs?page=run%3A5e913a26-1874-4299-bd12-66bac6c3ecb6&tab=agents"),
    ("agents.run.ask", f"{G}/agents/runs?page=run%3Af1adc938-ab40-4f76-8f56-a8bbf46e1b6d&tab=stages&step=34df16b6-f05f-4c7d-831f-6a2d56f9507a"),
    ("agents.run", f"{G}/agents/runs?page=run%3A5e913a26-1874-4299-bd12-66bac6c3ecb6&tab=agents"),
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
    ("agents.pools", f"{G}/agents/workers"),
    ("agents.pool.detail", f"{G}/agents/workers?page=worker_pool%3Ak8s-prod"),
    ("agents.pool.worker", f"{G}/agents/workers?page=worker%3Aw-k8s-prod-01"),
    ("agents.pool.capacity", f"{G}/agents/workers/capacity"),
    ("agents.workers.tokens", f"{G}/agents/workers/tokens"),
    ("agents.workers.add.pool", f"{G}/agents/workers?add=pool&pool=egress"),
    ("agents.workers.add.token", f"{G}/agents/workers?add=token&pool=egress"),
    ("agents.workers.add.run.docker", f"{G}/agents/workers?add=token&pool=egress&where=docker"),
    ("agents.workers.add.run.python", f"{G}/agents/workers?add=token&pool=egress&where=python"),
    ("agents.workers.add.run.k8s", f"{G}/agents/workers?add=token&pool=egress&where=kubernetes"),
    ("agents.workers.add.waiting", f"{G}/agents/workers?add=joined&pool=gpu-lab"),
    ("agents.workers.add.joined", f"{G}/agents/workers?add=joined&pool=egress"),
    ("agents.workers.add", f"{G}/agents/workers?add=where&pool=egress"),
    ("agents.connections.mcp", f"{G}/agents/connections/mcp"),
    ("agents.connections", f"{G}/agents/connections/server"),
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
POLICIES = "fare-team-quota and agent-readers are seeded by scripts/agents-build/seed_i01.py"
BUILT = {"agent-fabric": {"AF-26", "AF-02", "AF-01", "AF-17", "AF-19", "AF-20", "AF-23", "AF-25",
                         "AF-03", "AF-04", "AF-05", "AF-06", "AF-21", "AF-22",
                         "AF-07", "AF-08", "AF-09", "AF-10", "AF-11", "AF-13", "AF-14", "AF-16", "AF-24", "AF-18"}}
STATE = {  # board → how to reach it from its route; a board absent here is its route's landing view
    "iam.agent.effective": "the uuid stands for Coordinator, which holds fare-team-quota through fare-team and has the skill Hey bound: IAM › Agents, click Coordinator",
    "iam.policies.denied": "New policy, signed in as e2e-viewer (its `as`)",
    "iam.policy.statements": POLICIES, "iam.policy.limits": POLICIES, "iam.policy.held_by": POLICIES,
    "iam.policy.test": f"{POLICIES}; Test access on the head — the link carries the proto's check: Fare Scout, started by priya, graph.write.records on graph/Fare/LHR-JFK · price",
    "iam.policy.draft": f"{POLICIES}; the assistant's draft",
    "iam.policy.impact": f"{POLICIES}; Review impact on the draft",
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
    "agents.skill.locked": f"{SKILL}, signed in as e2e-viewer (its `as`; e2e/roles-agents.spec.ts makes the account)",
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
    "modeller.global_model.stitch": "click the anchored stitch Country ≡ country in the union list",
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
    "modeller.models.report": "a saved report of the Overview, pinned by id (MODELS_REPORT)",
    "modeller.model.type.constraint": "AirRoutes › airport: a row's Edit constraint, a range typed in",
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
    "agents.run.step": f"{TREE}; Stages tab, the first stage's step open (the step uuid is its graph read)",
    "agents.run.assets": f"{TREE}; Assets tab",
    "agents.run.touched": f"{TREE}; Data touched tab",
    "agents.run.rerun": "the uuid stands for a served run of Route Auditor; Rerun",
    "agents.run.closed": f"{TREE}; Agents tab, the assistant closed",
    "agents.run.approval": f"{TREE}; Agents — the delegation ask drawn on the tree (the assistant's proposal card needs a live session)",
    "agents.run.ask": "the uuid stands for an Explorer answer's run (a served run with a session); Stages tab, its graph read's step open",
    "agents.run": f"{TREE}; Agents tab, Tree",
    "agents.approvals.alerts": "Alert rules tab — five seeded rules",
    "agents.ledger.entry": "Rows tab, click the first row (opens ?row=)",
    "agents.ledger.actor": "the uuid stands for Route Auditor",
    "agents.ledger.member": "signed in as e2e-viewer (its `as`)",
    "agents.runs.filtered": "Route Auditor's runs this month that were not served, as the assistant links them — the uuid stands for Route Auditor (seed_f05.py)",
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
    "agents.connections": "This Graph's server tab, the landing tab of Connections",
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
    "agents.pool.detail": "k8s-prod stands for a pool name (scripts/agents-build/seed_f06.py seeds the four pools): Workers › Pools, click a pool",
    "agents.pool.worker": "w-k8s-prod-01 stands for a worker name: open a pool, click a worker",
    "agents.pool.capacity": "Capacity tab",
    "agents.workers.tokens": "Join tokens tab",
    "agents.workers.add": "Add workers: step Where",
    "agents.workers.add.pool": "Add workers › Python › Next: step Pool, egress chosen",
    "agents.workers.add.token": "Add workers › Pool › Next › Make token: step Join token, the secret shown once",
    "agents.workers.add.run.docker": "Add workers › Docker › … › Make token: step Run it",
    "agents.workers.add.run.python": "Add workers › Python › … › Make token: step Run it",
    "agents.workers.add.run.k8s": "Add workers › Kubernetes › … › Make token: step Run it",
    "agents.workers.add.waiting": "Add workers › … › Run it › Next: step Joined, before the first heartbeat",
    "agents.workers.add.joined": "Add workers › … › Joined, after a worker started with the command joined",
    "agents.plugins": "needs B06a for its rows",
    "agents.plugins.plugin": "click a plugin (needs B06a)",
    "agents.plugins.task": "click a plugin, then a task type (needs B06a)",
}
AS = {  # board → the account shoot.mjs signs in as; a board absent here is shot as the default user
    b: "e2e-viewer" for b in ("iam.policies.denied", "agents.skill.locked", "agents.ledger.member")
}

CLICK = {  # board → buttons shoot.mjs presses after the route loads, for a state a URL may not hold
    "agents.workers.add.token": ["Make token"],
    **{f"agents.workers.add.run.{w}": ["Make token", "Next"] for w in ("docker", "python", "k8s")},
    "modeller.models.new": ["New model"],
    "modeller.global_model.dark": ["dark"],
    "modeller.global_model.diff": ["Compare"],
    "modeller.draft.publish": ["text:Publish v"],
    "modeller.draft.migration": ["text:Publish v"],
    "modeller.model.type.constraint": ["Edit constraint on runways", "fill:Lowest value=1", "fill:Highest value=3",
                                       "fill:Unit=runways", "text:Flag for review"],
    "modeller.global_model.stitch": ["text:Country ≡ country"],
    "modeller.rules.edit": ["text:Airport codes are IATA"],
    "modeller.guardrails.edit": ["New rule", "text:Read in counts only", "text:Stays in the Graph"],
    **{f"modeller.models.new.ontology{s}": ["More actions", "text:From an ontology",
                                            "text:File", "upload:demos/arabidopsis/semantic/schema-org-subset.ttl",
                                            "tick:Person", "tick:Organization", "tick:Product", *x]
       for s, x in (("", []), (".preview", ["Preview"]))},
}


def route_for(board: str) -> str | None:
    return next((r for p, r in ROUTES if board == p or board.startswith(p + ".") or board.startswith(p)), None)


def main() -> None:
    boards, missing = {}, []
    for doc in ["shell", "datasets", "modeller", "explorer", "projects", "agents", "agent-fabric", "iam"]:
        for m in re.finditer(r"^\| ([A-Z]{2,3}-\d{2}) \|(.*)$", (DOCS / f"{doc}.md").read_text(), re.M):
            if doc in BUILT and m.group(1) not in BUILT[doc]:
                continue
            for b in re.findall(r"`([a-z][a-z0-9_.]*)`", m.group(2)):
                variant = b.split(".")[-1] in {"dark", "readonly", "error", "closed"} or b.count(".") > 2
                route = route_for(b)
                if route is None or (variant and b not in STATE):
                    missing.append(b)
                if (route and b.startswith(("agents.", "iam.")) and not b.endswith(".closed")
                        and b not in {"agents.home", "agents.open", "iam.home"}):
                    # The Agents boards draw the assistant docked; `.closed` boards draw it closed,
                    # and Home's composer is the assistant before a thread exists.
                    route += ("&" if "?" in route else "?") + "right=assistant"
                boards[b] = {"story": m.group(1), "product": doc, "route": route, "state": STATE.get(b, "")}
                if b in AS:
                    boards[b]["as"] = AS[b]
                if b in CLICK:
                    boards[b]["click"] = CLICK[b]
    (ROOT / "scripts" / "migration" / "screen-map.json").write_text(json.dumps({"boards": boards}, indent=1))
    stale = sorted(set(STATE) - set(boards))
    print(len(boards), "boards mapped,", sum(1 for b in boards.values() if b["state"]), "with state")
    if stale:
        print("state for boards no doc names:", ", ".join(stale))
    if missing:
        sys.exit("no route or no state: " + ", ".join(missing))


if __name__ == "__main__":
    main()
