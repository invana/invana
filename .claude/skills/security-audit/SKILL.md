---
name: security-audit
description: Threat-model a spec, or audit a change or a release, for Invana's security — STRIDE over every act and data flow, the risks particular to an agent product (prompt injection through graph data, agents acting without a yes, data leaving a Graph), and open-source scans of everything Invana ships — code, dependencies, licenses, secrets, Dockerfiles, Compose, images, CI workflows, the running API and the agents — triage, and a fix recommended for each finding in agents-recommendations.md. Use for the security agent's calls, or whenever a change needs a security look. Never edits product code.
---

# Security audit — find it, triage it, say how to fix it

The procedure the **security** agent follows, and anyone else auditing Invana. How the team works around an audit is
`.claude/team/TEAM.md`. You write reports and recommendations only — never code, tests, a spec, a doc or a board. The
product manager takes each recommendation up; the coder makes the fix from it.

## 1. Scope

| Call | Read |
|---|---|
| Threat model | The feature's spec in `specs/` — its user journey, Access, `## Engine`, `## System impact`, every story's *Who can* and *Flow* — and `specs/system-design.md` § 7 (trust boundaries), § 11 (the outside boundary) and § 12 (security and privacy) |
| Change audit | The diff (`git diff <base>...HEAD`), its spec and feature file, QA's `code` report |
| Release audit | Everything since the last release tag, plus the scans in §3 over the whole tree and the built images |

## 2. Threat model

Walk every act in the Access table and every data flow in the journey through **STRIDE** — spoofing, tampering,
repudiation, information disclosure, denial of service, elevation of privilege — then the risks particular to Invana:

| Risk | Look for |
|---|---|
| Prompt injection | Graph data, documents, uploaded files or tool output reaching an LLM and read as instructions |
| Acting without a yes | An agent tool that writes, sends, spends or changes access before the person agrees |
| Data leaving a Graph | One Graph's records reaching another Graph's member, run, cache, embedding or prompt |
| Data leaving the install | Records sent to an AI provider or plugin the admin has not allowed; telemetry carrying data |
| Query injection | Cypher or Gremlin built by joining strings instead of passing parameters |
| Authorisation | A graph-scoped route not mapped to its area in `apps/graphs/roles.py`; a check done in Studio only |
| Secrets | Database credentials and AI-provider keys stored unencrypted, returned by the API, logged or traced |
| Outside systems | A connection URL or connector that lets a user reach internal hosts (SSRF) |
| Uploads | Size, type, archive bombs, formula injection in exported CSV |
| Cost and load | A query, agent loop or upload with no limit, timeout or token budget |
| Audit trail | An act — a person's or an agent's — with no record of who did it and when |
| Infrastructure | A default or dev credential (`docker/`, Compose) reaching a release image or a production compose file; a service bound beyond localhost that need not be; a container running as root; an image or a GitHub Action not pinned |

Each threat → its mitigation → the **criterion** the product manager should add (Given / When / Then), as a `raise`
row to the product manager. A mitigation that holds across features — a boundary, a limit, an encryption rule — is an
`NFR-SEC-<n>` the product manager adds to `system-design.md` § 3, with the check that enforces it.

## 3. Scan

Scan everything Invana ships. A change audit scans the surfaces the change touched; a release audit scans them all.

| Surface | In the repo | Tool |
|---|---|---|
| Code | `engine/`, `integrations/`, `studio/src` | Ruff `S` · Semgrep |
| Backend dependencies | Every `uv.lock` — root, `engine`, `docs`, each `integrations/invana-*` | Trivy fs |
| Frontend dependencies | `studio/pnpm-lock.yaml`, which carries `@invana/*` from design-kit and canvas | Trivy fs |
| Licenses | Every lockfile | Trivy fs, license scanner |
| Secrets | The git history and the working tree | Gitleaks |
| Dockerfiles · Compose | `engine/Dockerfile`, `studio/Dockerfile`, `docker-compose*.yml`, `docker/`; Kubernetes and Helm once they exist | Trivy config |
| Images | `invana/engine`, `invana/studio` as built | Trivy image |
| CI | `.github/workflows/*.yml` | zizmor |
| Running API and Studio | The local stack | OWASP ZAP · Schemathesis |
| Agents | An agent on `demos/airways` | promptfoo red-team |
| SBOM | The release images | Trivy → CycloneDX |

Run what applies; record each command and its result. A tool that cannot run is a `note` in the report, never a guess
at what it would have found. Scans and probes run against the local stack only (`docker compose up -d engine studio`;
the engine on `localhost:8200`).

| Kind | Tool | Run |
|---|---|---|
| SAST | Ruff `S` rules | `cd engine && uv run ruff check --select S .` |
| SAST | Semgrep CE | `uvx semgrep scan --config p/python --config p/typescript --config p/secrets engine studio/src` |
| Secrets | Gitleaks | `docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:latest detect -s /repo` |
| Dependencies | Trivy fs | `docker run --rm -v "$PWD:/src" aquasec/trivy fs --scanners vuln /src` |
| Licenses | Trivy fs | `docker run --rm -v "$PWD:/src" aquasec/trivy fs --scanners license /src` |
| Dockerfiles, Compose | Trivy config | `docker run --rm -v "$PWD:/src" aquasec/trivy config /src` |
| Images | Trivy image | `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --scanners vuln,secret,misconfig <image>` |
| CI | zizmor | `uvx zizmor .github/workflows` |
| SBOM | Trivy | `… aquasec/trivy image --format cyclonedx --output sbom-<image>.json <image>` — release audit only, kept beside the report |
| DAST | OWASP ZAP | `zap-api-scan.py` in `zaproxy/zap-stable`, against the engine's OpenAPI document on the local stack |
| API fuzzing | Schemathesis | `uvx schemathesis run <the engine's OpenAPI URL>` with a local admin and an operator token |
| LLM red-team | promptfoo red-team | Against an agent on `demos/airways`: injected instructions in node properties and documents, cross-Graph questions, acts that must ask first |

## 4. Triage

| Verdict | Means | Goes to |
|---|---|---|
| Real | Exploitable here, with how | A finding, severity below |
| False positive | Not reachable or not exploitable — say why in a line | The report's notes |
| Accepted risk | Real, but only Ravi can choose to live with it | A `decide` row |

| Severity | Blocks |
|---|---|
| Critical · high | A blocker — the story is not `built`, the release does not ship |
| Medium | A should-fix — a recommendation for the product manager to schedule |
| Low · info | A note |

## 5. Recommend the fix

For each real finding: what to change, where (file:line), in a line or a short snippet in the report — never applied.
It travels as a recommendation raised with the `recommend` skill — `--from security --kind security`, *Severity* as
triaged. The product manager takes it up: a fix for the coder, or a criterion, board or access change first. A critical
or high finding still fails the report — and the story or the release — until it is fixed or Ravi accepts the risk.

## 6. Report

Write `.agent-reports/security/<ID>-<call>.md` in the shape of `.claude/team/TEAM.md` §3 *Reports*: line 1 exactly
`RESULT: PASS` or `RESULT: FAIL` (FAIL with any critical or high finding); *Findings* — severity · STRIDE or risk ·
file:line, route or flow · what · how to fix; the scans run and their results; `## Recommendations` — the IDs you added; then *Requests*. Name where a secret
is, never its value. The folder is git-ignored; a report is never committed.
