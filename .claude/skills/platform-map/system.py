"""The system and code layers of the platform map, read from the code — never declared by hand.

What runs and how it hangs together, at the grain a design decision is made at — API area and module, never file or
endpoint.

| Node `type` | `data.layer` | Read from |
|---|---|---|
| `service` | `system` | `docker-compose.yml` services (a local graph database container rides on its connector instead) |
| `api` | `system` | Each `engine/src/invana/server/<area>`: its `APIRouter` prefixes and routes |
| `package` | `system` | `studio/packages/*/package.json` |
| `integration` | `system` | LLM providers named in `apps/llm_providers`, `integrations/invana-*` connectors, `plugins/{mcp,tools,simulators}` |
| `module` | `code` | `engine/src/invana/apps/*`, `core` and its submodules, and the other top-level engine packages |
| `group` | `view` | Nothing — a layout node so a service fans out in two steps; never part of an export |

Tree edges point parent → child; every node has exactly one tree parent.

| Tree edge | From → to |
|---|---|
| `runs` | platform → service |
| `hosts` | service → what it serves: the engine → its API and module groups, Studio → its packages |
| `contains` | group → member; platform → the integrations group |
| `has part` | `core` → each `core/*` submodule |

Cross edges point dependent → dependency, so "what breaks if X is down" is reverse reachability over them.

| Cross edge | From → to | Read from |
|---|---|---|
| `calls` | package → API | `/api/v1/…` URLs in the package's code, matched to the routes' first segments |
| `served by` | API → module | The API area's own imports |
| `depends on` | module → module · package → package | `from invana.<pkg>…` imports · `@invana-studio/*` dependencies |
| `uses` | module → integration | A fixed rule, not an import: `llm_providers` → each provider, `graph` → each connector, `plugins` → each tool kind |
| `needs` | service → service | Compose `depends_on` |
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ENGINE = "engine/src/invana"
GRAPH_BASE = "/api/v1/u/{username}/{graphSlug}"
LLM_NAMES = {
    "anthropic": "Anthropic (Claude)",
    "openai": "OpenAI",
    "ollama": "Ollama",
    "bedrock": "Amazon Bedrock",
    "gemini": "Google Gemini",
    "mistral": "Mistral",
}
DB_NAMES = {
    "neo4j": "Neo4j",
    "memgraph": "Memgraph",
    "arcadedb": "ArcadeDB",
    "janusgraph": "JanusGraph",
    "neptune": "Amazon Neptune",
    "tinkergraph": "TinkerGraph",
}
TOOL_KINDS = {"mcp": "MCP servers", "tools": "Tool plugins", "simulators": "Simulators"}
# Engine packages that are not modules of their own on the map: `apps` is expanded into its apps, `server` into APIs.
SKIP_TOP = {"apps", "server", "__pycache__"}


def _py_files(path: Path) -> list[Path]:
    return [path] if path.is_file() else [p for p in path.rglob("*.py") if "__pycache__" not in p.parts]


def _compose(repo: Path) -> dict[str, dict[str, object]]:
    """Top-level compose services with their `image`, build `target` and `depends_on` — a parser for this file's shape."""
    services: dict[str, dict[str, object]] = {}
    section = cur = sub = None
    for line in (repo / "docker-compose.yml").read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        text = line.strip()
        if indent == 0:
            section = text.rstrip(":")
            continue
        if section != "services":
            continue
        if indent == 2 and text.endswith(":"):
            cur = text[:-1]
            services[cur] = {"depends_on": []}
            sub = None
        elif indent == 4 and cur:
            key, _, value = text.partition(":")
            sub = key
            if key == "image":
                services[cur]["image"] = value.strip().strip("\"'")
        elif indent >= 6 and cur and sub == "depends_on":
            name = text.lstrip("- ").rstrip(":").strip()
            if indent == 6 and name:
                services[cur]["depends_on"].append(name)  # type: ignore[union-attr]
        elif indent == 6 and cur and sub == "build" and text.startswith("target:"):
            services[cur]["target"] = text.partition(":")[2].strip()
    return services


def _engine_modules(repo: Path) -> dict[str, dict[str, object]]:
    """Module id → its path and kind: every app, `core` and each of its submodules, and the other top-level packages."""
    root = repo / ENGINE
    mods: dict[str, dict[str, object]] = {}
    for app in sorted((root / "apps").iterdir()):
        if app.is_dir() and not app.name.startswith("__"):
            mods[f"apps/{app.name}"] = {"path": app, "kind": "Engine app", "name": app.name}
    for top in sorted(root.iterdir()):
        if top.is_dir() and top.name not in SKIP_TOP and not top.name.startswith("__"):
            mods[top.name] = {"path": top, "kind": "Core" if top.name == "core" else "Engine package", "name": top.name}
    for sub in sorted((root / "core").iterdir()):
        if sub.name.startswith("__") or (sub.is_file() and sub.suffix != ".py"):
            continue
        mods[f"core/{sub.stem}"] = {"path": sub, "kind": "Core module", "name": f"core.{sub.stem}"}
    return mods


IMPORT = re.compile(r"^\s*(?:from|import)\s+invana\.([a-z_]+)(?:\.([a-z_]+))?", re.M)


def _imports(files: list[Path], mods: dict[str, dict[str, object]]) -> set[str]:
    """The module ids a set of files imports."""
    found: set[str] = set()
    for f in files:
        for top, sub in IMPORT.findall(f.read_text(encoding="utf-8", errors="ignore")):
            if top == "apps" and sub and f"apps/{sub}" in mods:
                found.add(f"apps/{sub}")
            elif top == "core":
                found.add(f"core/{sub}" if sub and f"core/{sub}" in mods else "core")
            elif top in mods:
                found.add(top)
    return found


ROUTER = re.compile(r"(\w+)\s*=\s*APIRouter\((.*?)\)", re.S)
# Both `@router.get("…")` decorators and `router.get("…")(view)` registrations.
ROUTE = re.compile(r"\b(\w+)\.(?:get|post|put|patch|delete|websocket|api_route)\(\s*f?\"([^\"]*)\"")


def _apis(repo: Path) -> dict[str, dict[str, object]]:
    """API area → its prefixes, route count, the first URL segments it answers (`g:seg` graph-scoped, `i:seg` install)."""
    server = repo / ENGINE / "server"
    areas: dict[str, list[Path]] = {}
    for f in sorted(server.rglob("*.py")):
        if "__pycache__" in f.parts:
            continue
        rel = f.relative_to(server)
        area = rel.stem if rel.parts[0] == "routes" else rel.parts[0]
        if len(rel.parts) == 1:
            continue  # app.py, middleware.py, health.py — the server itself
        areas.setdefault(area, []).append(f)
    apis: dict[str, dict[str, object]] = {}
    for area, files in areas.items():
        prefixes: set[str] = set()
        keys: set[str] = set()
        routes = 0
        for f in files:
            text = f.read_text(encoding="utf-8", errors="ignore")
            routers = {}
            for name, args in ROUTER.findall(text):
                m = re.search(r"prefix\s*=\s*f?\"([^\"]*)\"", args)
                routers[name] = m.group(1) if m else ""
            for name, path in ROUTE.findall(text):
                if name not in routers:
                    continue
                routes += 1
                full = routers[name] + path
                prefixes.add(routers[name] or "/")
                if full.startswith(GRAPH_BASE):
                    seg = full[len(GRAPH_BASE):].strip("/").split("/")[0]
                    keys.add(f"g:{seg}")
                elif full.startswith("/api/v1/"):
                    keys.add(f"i:{full[len('/api/v1/'):].split('/')[0]}")
        if routes:
            apis[area] = {"files": files, "prefixes": sorted(prefixes), "routes": routes, "keys": keys}
    return apis


INSTALL_URL = re.compile(r"/api/v1/([a-z][a-z0-9-]*)")
# `/api/v1/u/${owner}/${graph}/seg` names its segment outright.
GRAPH_LITERAL = re.compile(r"api/v1/u/\$\{[^}]+\}/\$\{[^}]+\}/([a-z][a-z0-9-]*)")
# The bare graph base — `/api/v1/u/${owner}/${graph}` with nothing after it.
GRAPH_BASE_ONLY = re.compile(r"api/v1/u/\$\{[^}]+\}/\$\{[^}]+\}(?![/a-z])")
# `${base(…)}/seg` — counted only in a file that builds the bare base, so `${iamBase}/agents` is not the agents API.
GRAPH_URL = re.compile(r"\}/([a-z][a-z0-9-]*)")


def _studio(repo: Path) -> dict[str, dict[str, object]]:
    """Studio package dir → its npm name, `@invana-studio/*` dependencies and the API keys its code calls."""
    pkgs: dict[str, dict[str, object]] = {}
    for pj in sorted((repo / "studio/packages").glob("*/package.json")):
        meta = json.loads(pj.read_text(encoding="utf-8"))
        deps = {**meta.get("dependencies", {}), **meta.get("peerDependencies", {})}
        keys: set[str] = set()
        for f in (pj.parent / "src").rglob("*.ts*"):
            if ".test." in f.name or ".stories." in f.name:
                continue
            text = f.read_text(encoding="utf-8", errors="ignore")
            if "api/v1" not in text:
                continue
            keys |= {f"i:{s}" for s in INSTALL_URL.findall(text) if s != "u"}
            keys |= {f"g:{s}" for s in GRAPH_LITERAL.findall(text)}
            if GRAPH_BASE_ONLY.search(text):
                keys |= {f"g:{s}" for s in GRAPH_URL.findall(text)}
        pkgs[pj.parent.name] = {
            "npm": meta.get("name", pj.parent.name),
            "deps": sorted(d.split("/")[-1] for d in deps if d.startswith("@invana-studio/")),
            "keys": keys,
        }
    return pkgs


def build(repo: Path) -> tuple[list[dict[str, object]], list[dict[str, object]], dict[str, object]]:
    """The system layer's nodes and edges, hung under the platform, plus the drift found while reading it."""
    nodes: list[dict[str, object]] = []
    edges: list[dict[str, object]] = []

    layer = {"module": "code", "group": "view"}

    def node(nid: str, ntype: str, kind: str, name: str, sub: str, **extra: object) -> None:
        data = {"layer": layer.get(ntype, "system"), "kind": kind, "name": name, "sub": sub, **extra}
        nodes.append({"id": nid, "type": ntype, "data": data})

    def edge(src: str, dst: str, etype: str) -> None:
        edges.append({"id": f"{src}-{etype}->{dst}", "source": src, "target": dst, "type": etype})

    mods = _engine_modules(repo)
    apis = _apis(repo)
    studio = _studio(repo)
    compose = _compose(repo)
    connectors = sorted(p.name for p in (repo / "integrations").glob("invana-*") if p.is_dir())

    # ── Services: the deployables. A local graph database container belongs to its connector.
    db_names = {c.removeprefix("invana-") for c in connectors}
    dev_db = {s: d for s in compose for d in db_names if re.sub(r"[_\d]+$", "", s) == d}
    services = [s for s in compose if s not in dev_db]
    for s in services:
        c = compose[s]
        sub = f"image {c['image']}" if c.get("image") else f"build target {c.get('target', '—')}"
        node(f"svc:{s}", "service", "Service", s, sub)
        edge("invana", f"svc:{s}", "runs")
    for s in services:
        for d in compose[s]["depends_on"]:  # type: ignore[union-attr]
            if d in services:
                edge(f"svc:{s}", f"svc:{d}", "needs")

    engine_svc = "svc:engine" if "engine" in compose else None
    studio_svc = "svc:studio" if "studio" in compose else None

    # ── Engine: APIs and modules, each under a group so the engine fans out in two steps.
    if engine_svc:
        node("grp:apis", "group", "Group", "APIs", f"{len(apis)} areas under /api/v1")
        node("grp:modules", "group", "Group", "Engine modules", f"{len(mods)} apps and packages")
        edge(engine_svc, "grp:apis", "hosts")
        edge(engine_svc, "grp:modules", "hosts")

    calls: dict[str, set[str]] = {a: set() for a in apis}
    for pkg, meta in studio.items():
        for area, api in apis.items():
            if meta["keys"] & api["keys"]:  # type: ignore[operator]
                calls[area].add(pkg)

    for area, api in sorted(apis.items()):
        callers = sorted(calls[area])
        node(
            f"api:{area}", "api", "API", area,
            " · ".join(p.replace(GRAPH_BASE, "/u/…") for p in api["prefixes"]),  # type: ignore[union-attr]
            stats=f"{api['routes']} routes · {len(callers)} Studio callers",
            **({"unclaimed": 1} if not callers else {}),
        )
        edge("grp:apis", f"api:{area}", "contains")
        for m in sorted(_imports(api["files"], mods)):  # type: ignore[arg-type]
            edge(f"api:{area}", f"mod:{m}", "served by")

    module_deps: dict[str, set[str]] = {}
    for mid, meta in mods.items():
        # `core` is its own top-level files only — each `core/*` submodule is a node of its own, so the core's
        # imports are not the sum of its parts (migrations alone import every app).
        files = sorted(Path(meta["path"]).glob("*.py")) if mid == "core" else _py_files(meta["path"])  # type: ignore[arg-type]
        deps = _imports(files, mods) - {mid}
        if mid == "core":
            deps = {d for d in deps if not d.startswith("core/")}
        module_deps[mid] = deps
    used_by = {m: sum(m in d for d in module_deps.values()) for m in mods}
    for mid, meta in mods.items():
        rel = Path(meta["path"]).relative_to(repo)  # type: ignore[arg-type]
        node(
            f"mod:{mid}", "module", str(meta["kind"]), str(meta["name"]), str(rel),
            stats=f"uses {len(module_deps[mid])} · used by {used_by[mid]}",
        )
        if mid.startswith("core/"):
            edge("mod:core", f"mod:{mid}", "has part")
        else:
            edge("grp:modules", f"mod:{mid}", "contains")
        for d in sorted(module_deps[mid]):
            if not (mid.startswith("core/") and d == "core"):
                edge(f"mod:{mid}", f"mod:{d}", "depends on")

    # ── Studio packages.
    for pkg, meta in studio.items():
        called = sorted(a for a in apis if pkg in calls[a])
        node(f"pkg:{pkg}", "package", "Studio package", pkg, str(meta["npm"]), stats=f"calls {len(called)} APIs")
        if studio_svc:
            edge(studio_svc, f"pkg:{pkg}", "hosts")
        for d in meta["deps"]:  # type: ignore[union-attr]
            if d in studio and d != pkg:
                edge(f"pkg:{pkg}", f"pkg:{d}", "depends on")
        for a in called:
            edge(f"pkg:{pkg}", f"api:{a}", "calls")

    # ── Integrations: what Invana reaches outside itself for.
    node("grp:integrations", "group", "Group", "Integrations", "LLM providers · graph databases · tools")
    edge("invana", "grp:integrations", "contains")
    llm_src = " ".join(
        f.read_text(encoding="utf-8", errors="ignore").lower()
        for f in _py_files(repo / ENGINE / "apps/llm_providers")
    )
    for key, name in LLM_NAMES.items():
        if key in llm_src:
            node(f"int:{key}", "integration", "LLM provider", name, "via apps/llm_providers")
            edge("grp:integrations", f"int:{key}", "contains")
            if "apps/llm_providers" in mods:
                edge("mod:apps/llm_providers", f"int:{key}", "uses")
    for c in connectors:
        db = c.removeprefix("invana-")
        local = next((s for s, d in dev_db.items() if d == db), None)
        node(f"int:{db}", "integration", "Graph database", DB_NAMES.get(db, db), c + (f" · local: {local}" if local else ""))
        edge("grp:integrations", f"int:{db}", "contains")
        if "graph" in mods:
            edge("mod:graph", f"int:{db}", "uses")
    for kind, name in TOOL_KINDS.items():
        if (repo / ENGINE / "plugins" / kind).is_dir():
            node(f"int:{kind}", "integration", "Tools", name, f"engine/src/invana/plugins/{kind}")
            edge("grp:integrations", f"int:{kind}", "contains")
            if "plugins" in mods:
                edge("mod:plugins", f"int:{kind}", "uses")

    drift = {"unclaimed_apis": sorted(a for a in apis if not calls[a])}
    counts = {
        "services": len(services),
        "apis": len(apis),
        "modules": len(mods),
        "packages": len(studio),
        "integrations": sum(n["type"] == "integration" for n in nodes),
    }
    return nodes, edges, {"drift": drift, "counts": counts, "modules": set(mods), "packages": set(studio)}
