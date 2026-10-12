"""Evals — the fixed questions a skill or an agent is replayed against
(docs/for-developers/modules/skills/features/evals.md).

**An eval run is a run.** ``open_run`` writes a root ``TaskRun`` with
``role=evaluate`` and, under it, one replayed ask per active case and side —
the same rows, trace and token count as any ask, with no session and no reply.
The runtime works the children; ``score`` then reads each settled child into a
``CaseRecord``, counts its rule checks, asks the judge when the set has one,
writes one ``eval_results`` row per case and side, and settles the root with a
summary and the gate's verdict.

**The candidate.** A side is ``live`` (what runs today) or ``draft`` (what is
about to). The draft side replays a *candidate*: the open draft, a version a
rollback would restore, or — for an agent — the same instructions on a new pin.
``candidate_digest`` fingerprints its text and pin, and the **gate** reads the
newest settled eval run over exactly that fingerprint: publish, rollback and a
pin move never run an eval inside their own request.

**What blocks and what warns.** A failed hard check on the draft side blocks.
Tokens or p95 more than 20% above live, or a judged mean 0.5 below it, warns,
and publishing past a warning needs a ``why``. A set with no active case gates
nothing and says so.

**Drift** re-runs the live side when something under it moves, and nightly.
A drift run is compared with the subject's last settled live run; fewer hard
passes, or p95 or tokens past 1.5x, emits ``eval.degraded``. At the Graph's
eval-token ceiling a drift run settles *paused: budget* without replaying.

Usage::

    evals = EvalManager()
    await evals.put_set(db, graph_id=g, subject_kind="skill", subject_id=s, actor_id=u)
    await evals.add_case(db, graph_id=g, subject_kind="skill", subject_id=s,
                         question="Which routes leave LHR?", checks=[{"kind": "cites_records"}], actor_id=u)
    await evals.propose(db, graph_id=g, subject_kind="skill", subject_id=s, actor_id=u, encryption_key=key)
    run = await evals.open_run(db, graph_id=g, subject_kind="skill", subject_id=s, side="both", actor_id=u)
    # commit; the runtime works the children, then:
    await evals.score(db, run_id=run.id, encryption_key=key)
    verdict = await evals.gate(db, graph_id=g, subject_kind="skill", subject_id=s, candidate=...)
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.models import Agent
from invana.apps.govern.managers import LLMEndpointManager
from invana.apps.llm import LLMError
from invana.apps.llm.judge import judge_answer
from invana.apps.llm.starter import propose_cases
from invana.apps.skills.models import Skill, SkillVersion
from invana.apps.skills.querysets.skill_version import SkillVersionQuerySet
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event
from invana.runtime import eval_checks
from invana.runtime.delegation import cost_rollup, descendants
from invana.runtime.models import (
    EvalBudget,
    EvalCase,
    EvalCaseStatus,
    EvalLabel,
    EvalResult,
    EvalSet,
    EvalSubject,
    RunRole,
    RunStatus,
    TaskRun,
    TriggeredBy,
)
from invana.runtime.querysets import EmissionQuerySet, EvalQuerySet
from invana.runtime.workflows import NL_QUERY

#: Over live by more than this, tokens or p95 warn at the gate.
WARN_RATIO = 1.2
#: A judged mean this far below live warns.
WARN_JUDGED_DROP = 0.5
#: Past this multiple of the last live run, a drift run is degraded.
DEGRADED_RATIO = 1.5

SIDES = ("live", "draft")
#: Why a person opened an eval run.
USER_TRIGGERS = frozenset({"manual", "publish", "rollback", "pin"})
#: Why the platform did — a drift re-run.
DRIFT_TRIGGERS = frozenset({"pin_moved", "model_publish", "world_change", "nightly"})


@dataclass(frozen=True, slots=True)
class Candidate:
    """What the draft side replays, and its fingerprint."""

    kind: str  # draft · version · model_pin
    #: A skill: the version id replayed. An agent: None.
    skill_version_id: str | None
    #: An agent: the instructions replayed. A skill: None.
    instructions: str | None
    model_pin: str | None
    digest: str

    def describe(self) -> dict[str, Any]:
        return {"kind": self.kind, "skill_version_id": self.skill_version_id, "model_pin": self.model_pin}


def _fingerprint(text_sha: str, pin: str | None) -> str:
    return hashlib.sha256(json.dumps([text_sha, pin or ""]).encode("utf-8")).hexdigest()


def _subject(kind: str, subject_id: str) -> str:
    return f"{kind}:{subject_id}"


def _month_start() -> datetime:
    now = datetime.now(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


class EvalManager:
    qs = EvalQuerySet()
    emissions = EmissionQuerySet()
    versions = SkillVersionQuerySet()
    endpoints = LLMEndpointManager()

    # ── the subject ──────────────────────────────────────────────────────────

    async def _require_subject(self, db: AsyncSession, *, graph_id: str, kind: str, subject_id: str):
        if kind not in EvalSubject.__members__:
            raise ValidationError(f"'{kind}' has no evals. Use skill or agent.")
        row = await db.get(Skill if kind == EvalSubject.skill else Agent, subject_id)
        if row is None or row.graph_id != graph_id:
            raise NotFoundError(f"{kind.capitalize()} not found.")
        return row

    async def _subject_pin(self, db: AsyncSession, subject) -> str | None:
        if isinstance(subject, Agent):
            return subject.model_pin
        head = subject.current_version
        return head.model_pin if head is not None else None

    # ── the set ──────────────────────────────────────────────────────────────

    async def get_set(self, db: AsyncSession, *, graph_id: str, subject_kind: str, subject_id: str) -> EvalSet:
        """The subject's set; one that was never written reads as an empty set, unsaved."""
        await self._require_subject(db, graph_id=graph_id, kind=subject_kind, subject_id=subject_id)
        found = await self.qs.set_for(db, subject_kind=subject_kind, subject_id=subject_id)
        return found or EvalSet(graph_id=graph_id, subject_kind=subject_kind, subject_id=subject_id)

    async def _ensure_set(self, db: AsyncSession, *, graph_id: str, subject_kind: str, subject_id: str) -> EvalSet:
        await self._require_subject(db, graph_id=graph_id, kind=subject_kind, subject_id=subject_id)
        found = await self.qs.set_for(db, subject_kind=subject_kind, subject_id=subject_id)
        if found is not None:
            return found
        row = EvalSet(graph_id=graph_id, subject_kind=subject_kind, subject_id=subject_id)
        await self.qs.add(db, row)
        return row

    async def put_set(
        self,
        db: AsyncSession,
        *,
        graph_id: str,
        subject_kind: str,
        subject_id: str,
        actor_id: str,
        judge_model_pin: str | None = None,
        rubric: str | None = None,
    ) -> EvalSet:
        """Write the judge pin and rubric. A judge pinned to the subject's own model is refused, naming both."""
        subject = await self._require_subject(db, graph_id=graph_id, kind=subject_kind, subject_id=subject_id)
        pin = None
        if judge_model_pin:
            pin = await self.endpoints.check_pin(db, graph_id=graph_id, address=judge_model_pin)
            under_test = await self._subject_pin(db, subject)
            if under_test and under_test == pin:
                raise ValidationError(
                    {
                        "error": "judge_same_model",
                        "message": f"The judge pins {pin}, the model under test — a judge grades another model's work.",
                        "judge": pin,
                        "subject": under_test,
                    }
                )
        row = await self._ensure_set(db, graph_id=graph_id, subject_kind=subject_kind, subject_id=subject_id)
        row.judge_model_pin = pin
        row.rubric = (rubric or "").strip() or None
        await db.flush()
        await emit_event(
            db,
            action=actions.EVAL_SET_UPDATE,
            target_kind=actions.TARGET_EVAL_SET,
            target_id=row.id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"subject": _subject(subject_kind, subject_id), "judge_model_pin": pin},
        )
        return row

    # ── cases ────────────────────────────────────────────────────────────────

    @staticmethod
    def _checked(checks: list[dict]) -> list[dict]:
        out = []
        for check in checks:
            problem = eval_checks.check_problem(check)
            if problem:
                raise ValidationError({"error": "check_invalid", "message": problem})
            out.append({"kind": check["kind"], "value": check.get("value")})
        return out

    async def cases(self, db: AsyncSession, *, eval_set: EvalSet) -> list[EvalCase]:
        return await self.qs.cases(db, eval_set_id=eval_set.id) if eval_set.id else []

    async def add_case(
        self,
        db: AsyncSession,
        *,
        graph_id: str,
        subject_kind: str,
        subject_id: str,
        question: str,
        checks: list[dict],
        actor_id: str,
        label: str = EvalLabel.passing.value,
        proposed: bool = False,
        source_run_id: str | None = None,
        model_version: str | None = None,
    ) -> EvalCase:
        """A case written by a person, or proposed — which waits until a person accepts it."""
        if not question.strip():
            raise ValidationError("A case needs a question.")
        if label not in EvalLabel.__members__:
            raise ValidationError(f"'{label}' is not a label. Use passing or failing.")
        eval_set = await self._ensure_set(db, graph_id=graph_id, subject_kind=subject_kind, subject_id=subject_id)
        row = EvalCase(
            eval_set_id=eval_set.id,
            question=question.strip(),
            checks=self._checked(checks),
            label=label,
            status=(EvalCaseStatus.proposed if proposed else EvalCaseStatus.active).value,
            source_run_id=source_run_id,
            created_by_id=actor_id,
        )
        await self.qs.add(db, row)
        await emit_event(
            db,
            action=actions.EVAL_CASE_CREATE,
            target_kind=actions.TARGET_EVAL_SET,
            target_id=eval_set.id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={
                "case_id": row.id,
                "label": row.label,
                "status": row.status,
                "source_run_id": source_run_id,
                **({"model_version": model_version} if model_version else {}),
            },
        )
        return row

    async def propose(
        self, db: AsyncSession, *, graph_id: str, subject_kind: str, subject_id: str, actor_id: str, encryption_key: str
    ) -> list[EvalCase]:
        """The assistant's starter set: up to five cases from the subject's text, each waiting as ``proposed``.

        Reads the open draft when there is one, else what is live, and asks the
        subject's own pinned model — the Graph's decide model when it has none.
        """
        subject = await self._require_subject(db, graph_id=graph_id, kind=subject_kind, subject_id=subject_id)
        if isinstance(subject, Agent):
            text = subject.instructions_draft if subject.instructions_draft is not None else subject.instructions
        else:
            row = await self.versions.get_draft(db, subject.id) or subject.current_version
            text = row.content if row is not None else ""
        if not (text or "").strip():
            raise ConflictError(f"'{subject.name}' has no instructions to propose cases from.")
        provider = await self.endpoints.resolve(db, graph_id=graph_id, pins=(await self._subject_pin(db, subject),))
        try:
            proposed = await propose_cases(provider=provider, instructions=text, encryption_key=encryption_key)
        except LLMError as exc:
            raise ConflictError({"error": "propose_failed", "message": str(exc)}) from exc
        return [
            await self.add_case(
                db,
                graph_id=graph_id,
                subject_kind=subject_kind,
                subject_id=subject_id,
                question=case["question"],
                checks=case["checks"],
                actor_id=actor_id,
                proposed=True,
                model_version=proposed.model_version,
            )
            for case in proposed.cases
        ]

    async def _require_case(
        self, db: AsyncSession, *, graph_id: str, subject_kind: str, subject_id: str, case_id: str
    ) -> tuple[EvalSet, EvalCase]:
        await self._require_subject(db, graph_id=graph_id, kind=subject_kind, subject_id=subject_id)
        eval_set = await self.qs.set_for(db, subject_kind=subject_kind, subject_id=subject_id)
        case = await self.qs.case(db, eval_set_id=eval_set.id, case_id=case_id) if eval_set else None
        if eval_set is None or case is None:
            raise NotFoundError("Case not found.")
        return eval_set, case

    async def update_case(
        self,
        db: AsyncSession,
        *,
        graph_id: str,
        subject_kind: str,
        subject_id: str,
        case_id: str,
        actor_id: str,
        fields: dict[str, Any],
    ) -> EvalCase:
        """Accept a proposed case, relabel, retire, or rewrite its question or checks."""
        eval_set, case = await self._require_case(
            db, graph_id=graph_id, subject_kind=subject_kind, subject_id=subject_id, case_id=case_id
        )
        if "status" in fields and fields["status"] not in EvalCaseStatus.__members__:
            raise ValidationError(f"'{fields['status']}' is not a case status.")
        if "label" in fields and fields["label"] not in EvalLabel.__members__:
            raise ValidationError(f"'{fields['label']}' is not a label. Use passing or failing.")
        if "checks" in fields:
            fields = {**fields, "checks": self._checked(fields["checks"])}
        for name in ("question", "checks", "label", "status"):
            if name in fields and fields[name] is not None:
                setattr(case, name, fields[name])
        await db.flush()
        await emit_event(
            db,
            action=actions.EVAL_CASE_UPDATE,
            target_kind=actions.TARGET_EVAL_SET,
            target_id=eval_set.id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"case_id": case.id, "changed": sorted(k for k, v in fields.items() if v is not None)},
        )
        return case

    async def delete_case(
        self, db: AsyncSession, *, graph_id: str, subject_kind: str, subject_id: str, case_id: str, actor_id: str
    ) -> None:
        eval_set, case = await self._require_case(
            db, graph_id=graph_id, subject_kind=subject_kind, subject_id=subject_id, case_id=case_id
        )
        await self.qs.delete(db, case)
        await emit_event(
            db,
            action=actions.EVAL_CASE_DELETE,
            target_kind=actions.TARGET_EVAL_SET,
            target_id=eval_set.id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"case_id": case_id},
        )

    async def promote(
        self,
        db: AsyncSession,
        *,
        graph_id: str,
        run_id: str,
        subject_kind: str,
        subject_id: str,
        label: str,
        actor_id: str,
        actor_kind: str = ActorKind.user.value,
        checks: list[dict] | None = None,
    ) -> EvalCase:
        """A real ask becomes a case — a person's act, never an agent's.

        A passing case with no checks given takes them from the run itself:
        *cannot answer* when it said so, else *cites records* and the world it
        ran in. A failing case keeps the checks it is given.
        """
        if actor_kind != ActorKind.user.value:
            raise PermissionDeniedError("Only a person promotes an ask to an eval case.")
        run = await db.get(TaskRun, run_id)
        if run is None or run.graph_id != graph_id or run.parent_run_id is not None or not run.body:
            raise NotFoundError("Run not found.")
        if run.status not in (RunStatus.succeeded.value, RunStatus.failed.value):
            raise ConflictError("This run has not settled — promote a settled run only.")
        if checks is None and label == EvalLabel.passing.value:
            if run.outcome == "cannot_answer":
                checks = [{"kind": "cannot_answer"}]
            else:
                checks = [{"kind": "cites_records"}, {"kind": "names_world", "value": _world_of(run)}]
        return await self.add_case(
            db,
            graph_id=graph_id,
            subject_kind=subject_kind,
            subject_id=subject_id,
            question=run.body,
            checks=checks or [],
            label=label,
            actor_id=actor_id,
            source_run_id=run.id,
        )

    # ── the candidate ────────────────────────────────────────────────────────

    async def candidate(
        self,
        db: AsyncSession,
        *,
        subject,
        version: int | None = None,
        model_pin: str | None = None,
        unchanged_pin: bool = True,
    ) -> Candidate:
        """What the draft side replays: the open draft, a version, or a new pin.

        ``model_pin`` with ``unchanged_pin=False`` overrides the pin the text
        carries — a publish that moves a skill's pin, an agent's pin move.
        """
        if isinstance(subject, Agent):
            if version is not None:
                text, kind = await AgentManager().instructions_at(db, agent=subject, version=version), "version"
            elif not unchanged_pin:
                text, kind = subject.instructions, "model_pin"
            elif subject.instructions_draft is not None:
                text, kind = subject.instructions_draft, "draft"
            else:
                raise ConflictError(f"'{subject.name}' has no draft of its instructions to evaluate.")
            pin = model_pin if not unchanged_pin else subject.model_pin
            return Candidate(kind, None, text, pin, _fingerprint(eval_checks.digest(text), pin))
        if version is not None:
            row = await self.versions.get_by_number(db, subject.id, version)
            if row is None or row.is_draft:
                raise NotFoundError(f"Version {version} of '{subject.name}' not found.")
            kind = "version"
        else:
            row = await self.versions.get_draft(db, subject.id)
            if row is None:
                raise ConflictError(f"'{subject.name}' has no draft to evaluate.")
            kind = "draft"
        pin = model_pin if not unchanged_pin else row.model_pin
        return Candidate(kind, row.id, None, pin, _fingerprint(row.digest(), pin))

    def _live(self, subject) -> Candidate:
        if isinstance(subject, Agent):
            text = subject.instructions
            return Candidate(
                "live", None, text, subject.model_pin, _fingerprint(eval_checks.digest(text), subject.model_pin)
            )
        head: SkillVersion | None = subject.current_version
        if head is None:
            raise ConflictError(f"'{subject.name}' has no published version to replay as live.")
        return Candidate("live", head.id, None, head.model_pin, _fingerprint(head.digest(), head.model_pin))

    # ── runs ─────────────────────────────────────────────────────────────────

    async def open_run(
        self,
        db: AsyncSession,
        *,
        graph_id: str,
        subject_kind: str,
        subject_id: str,
        side: str,
        actor_id: str | None,
        trigger: str = "manual",
        version: int | None = None,
        model_pin: str | None = None,
    ) -> TaskRun:
        """Write an eval run and its replayed asks; the caller commits and submits it.

        ``version`` and ``model_pin`` name a rollback's or a pin move's
        candidate; neither is the open draft. A drift trigger at the Graph's
        eval-token ceiling settles the run *paused: budget* with no children.
        """
        if side not in ("live", "draft", "both"):
            raise ValidationError(f"'{side}' is not a side. Use live, draft or both.")
        subject = await self._require_subject(db, graph_id=graph_id, kind=subject_kind, subject_id=subject_id)
        eval_set = await self.qs.set_for(db, subject_kind=subject_kind, subject_id=subject_id)
        cases = await self.qs.cases(db, eval_set_id=eval_set.id, status="active") if eval_set else []
        if not cases:
            raise ConflictError({"error": "no_cases", "message": "This eval set has no active case to replay."})

        sides = SIDES if side == "both" else (side,)
        live = self._live(subject) if "live" in sides else None
        cand = None
        if "draft" in sides:
            if model_pin:
                model_pin = await self.endpoints.check_pin(db, graph_id=graph_id, address=model_pin)
            cand = await self.candidate(
                db, subject=subject, version=version, model_pin=model_pin, unchanged_pin=model_pin is None
            )

        if trigger not in USER_TRIGGERS | DRIFT_TRIGGERS:
            raise ValidationError(f"'{trigger}' is not an eval trigger.")
        system = trigger in DRIFT_TRIGGERS
        root = TaskRun(
            graph_id=graph_id,
            role=RunRole.evaluate.value,
            workflow_key="eval",
            label=_subject(subject_kind, subject_id),
            author_id=actor_id,
            author_kind="user" if actor_id else "system",
            triggered_by=(TriggeredBy.system if system else TriggeredBy.user).value,
            on_behalf_of_user_id=actor_id,
            params={
                "trigger": trigger,
                "side": side,
                "eval_set_id": eval_set.id,
                "candidate": cand.describe() if cand else None,
                "candidate_digest": cand.digest if cand else None,
                "live_digest": live.digest if live else None,
            },
            status=RunStatus.queued.value,
        )
        db.add(root)
        await db.flush()

        budget = await self.budget(db, graph_id=graph_id)
        if system and budget["monthly_tokens"] is not None and budget["spent"] >= budget["monthly_tokens"]:
            root.status = RunStatus.skipped.value
            root.outcome = "paused"
            root.detail = "paused: budget reached"
            root.finished_at = datetime.now(UTC)
            await db.flush()
            return root

        agent = subject if isinstance(subject, Agent) else None
        seq = 0
        for case in cases:
            for s in sides:
                picked = cand if s == "draft" else live
                assert picked is not None
                await self._open_case(db, root=root, case=case, side=s, picked=picked, agent=agent, seq=seq)
                seq += 1
        root.detail = f"{len(cases)} cases · {' and '.join(sides)}"
        await db.flush()
        return root

    async def _open_case(
        self, db: AsyncSession, *, root: TaskRun, case: EvalCase, side: str, picked: Candidate, agent, seq: int
    ) -> TaskRun:
        # planning and services both import this package, so either at module level is a cycle.
        from invana.runtime.planning import opening_for  # noqa: PLC0415
        from invana.runtime.services import (  # noqa: PLC0415
            _queue_opening,
            _queue_steps,
            freeze_lens,
            resolve_endpoint,
        )

        frozen = await freeze_lens(db, graph_id=root.graph_id, agent_id=agent.id if agent else None, lens_id=None)
        provider = await resolve_endpoint(
            db,
            graph_id=root.graph_id,
            snapshot=frozen["lens_snapshot"],
            pins=(picked.model_pin, agent.model_pin if agent else None),
        )
        replay = {"side": side, "case_id": case.id}
        if picked.skill_version_id:
            replay |= {"skill_id": root.label.split(":", 1)[1], "skill_version_id": picked.skill_version_id}
        if picked.instructions is not None:
            replay["instructions"] = picked.instructions
        child = TaskRun(
            graph_id=root.graph_id,
            parent_run_id=root.id,
            seq=seq,
            lane=side,
            role=RunRole.evaluate.value,
            author_id=root.author_id,
            author_kind=root.author_kind,
            ask_kind="nl",
            body=case.question,
            params={"llm_model_id": provider.model_row_id, "eval": replay},
            workflow_key=NL_QUERY.key,
            label=f"{side} · case {seq // 2 + 1}" if root.params.get("side") == "both" else f"{side} · case {seq + 1}",
            agent_id=agent.id if agent else None,
            agent_version=agent.version if agent else None,
            model_version=provider.model_id,
            triggered_by=root.triggered_by,
            on_behalf_of_user_id=root.on_behalf_of_user_id,
            **frozen,
        )
        db.add(child)
        await db.flush()
        opening = opening_for(agent, ask_kind="nl") if agent is not None else None
        if opening is not None:
            _queue_opening(db, child, None, opening)
        else:
            _queue_steps(db, child, None, NL_QUERY)
        return child

    async def case_runs(self, db: AsyncSession, *, run_id: str) -> list[TaskRun]:
        return await self.qs.children(db, run_id=run_id)

    async def runs(self, db: AsyncSession, *, graph_id: str, subject_kind: str, subject_id: str) -> list[TaskRun]:
        await self._require_subject(db, graph_id=graph_id, kind=subject_kind, subject_id=subject_id)
        return await self.qs.runs(db, graph_id=graph_id, subject=_subject(subject_kind, subject_id))

    async def run(
        self, db: AsyncSession, *, graph_id: str, subject_kind: str, subject_id: str, run_id: str
    ) -> tuple[TaskRun, list[EvalResult]]:
        run = await db.get(TaskRun, run_id)
        if run is None or run.graph_id != graph_id or run.label != _subject(subject_kind, subject_id):
            raise NotFoundError("Eval run not found.")
        return run, await self.qs.results(db, run_id=run.id)

    # ── scoring ──────────────────────────────────────────────────────────────

    async def record_of(self, db: AsyncSession, *, run: TaskRun) -> eval_checks.CaseRecord:
        """One settled replay, reduced to the facts its checks read."""
        emitted = await self.emissions.for_run(db, run_id=run.id)
        tree = [run.id, *await descendants(db, run.id)]
        touches = await self.qs.touches(db, run_ids=tree)
        refused = {t.address for t in touches if t.direction == "refused"}
        answered = {t.address for t in touches if t.direction == "in"}
        tokens = (await cost_rollup(db, run_id=run.id))["total_tokens"]
        latency = 0
        if run.started_at and run.finished_at:
            latency = int((_aware(run.finished_at) - _aware(run.started_at)).total_seconds() * 1000)
        reason = str((run.error or {}).get("message") or "") if run.outcome == "cannot_answer" else ""
        return eval_checks.CaseRecord(
            outcome=run.outcome,
            tokens=int(tokens),
            latency_ms=latency,
            world=_world_of(run),
            cited_ids=eval_checks.cited_ids(e.payload for e in emitted),
            record_count=sum(int((e.citation or {}).get("record_count") or 0) for e in emitted),
            guardrail_held=not (refused & answered),
            answer=eval_checks.answer_text(((e.kind, e.payload) for e in emitted), outcome=run.outcome, reason=reason),
        )

    async def score(self, db: AsyncSession, *, run_id: str, encryption_key: str) -> TaskRun:
        """Count every settled replay, settle the eval run, and emit what it found."""
        root = await db.get(TaskRun, run_id)
        if root is None or root.role != RunRole.evaluate.value or root.parent_run_id is not None:
            raise NotFoundError("Eval run not found.")
        eval_set = await db.get(EvalSet, (root.params or {}).get("eval_set_id"))
        cases = {c.id: c for c in await self.qs.cases(db, eval_set_id=eval_set.id)} if eval_set else {}
        judge = await self._judge_endpoint(db, eval_set)
        judge_tokens = 0
        for child in await self.qs.children(db, run_id=root.id):
            replay = (child.params or {}).get("eval") or {}
            case = cases.get(replay.get("case_id"))
            if case is None:
                continue
            rec = await self.record_of(db, run=child)
            judged = None
            if judge is not None and eval_set.rubric and judge.model_id != child.model_version:
                try:
                    out = await judge_answer(
                        provider=judge,
                        rubric=eval_set.rubric,
                        question=case.question,
                        answer=rec.answer,
                        encryption_key=encryption_key,
                    )
                    judged = out.score
                    judge_tokens += out.usage.input_tokens + out.usage.output_tokens
                except LLMError:
                    judged = None
            await self.qs.add(
                db,
                EvalResult(
                    eval_run_id=root.id,
                    eval_case_id=case.id,
                    case_run_id=child.id,
                    side=replay.get("side", "live"),
                    hard=eval_checks.verdicts(case.checks, rec),
                    judged=judged,
                    tokens=rec.tokens,
                    latency_ms=rec.latency_ms,
                    answer_digest=eval_checks.digest(rec.answer),
                ),
            )
        results = await self.qs.results(db, run_id=root.id)
        summary = summarize(results)
        root.tokens_in = judge_tokens
        root.tokens_out = 0
        root.status = RunStatus.succeeded.value
        root.outcome = summary["gate"]["verdict"]
        root.finished_at = datetime.now(UTC)
        root.result = {"eval": summary}
        await db.flush()
        await emit_event(
            db,
            action=actions.EVAL_RUN,
            target_kind=actions.TARGET_EVAL_SET,
            target_id=eval_set.id if eval_set else None,
            graph_id=root.graph_id,
            actor_id=root.author_id,
            actor_kind=ActorKind.user if root.author_id else ActorKind.system,
            run_id=root.id,
            details={"trigger": root.params.get("trigger"), "subject": root.label, "gate": summary["gate"]},
        )
        if root.params.get("side") == "live":
            await self._check_drift(db, root=root, summary=summary)
        return root

    async def _judge_endpoint(self, db: AsyncSession, eval_set: EvalSet | None):
        if eval_set is None or not eval_set.judge_model_pin or not eval_set.rubric:
            return None
        try:
            return await self.endpoints.resolve(
                db, graph_id=eval_set.graph_id, effective=None, pins=(eval_set.judge_model_pin,)
            )
        except ValidationError:
            return None

    async def _check_drift(self, db: AsyncSession, *, root: TaskRun, summary: dict) -> None:
        """Compare a live run with the subject's last settled live run; emit ``eval.degraded`` when worse."""
        before = next(
            (
                r
                for r in await self.qs.settled_runs(db, graph_id=root.graph_id, subject=root.label)
                if r.id != root.id and (r.result or {}).get("eval", {}).get("sides", {}).get("live")
            ),
            None,
        )
        if before is None:
            return
        was, now = before.result["eval"]["sides"]["live"], summary["sides"]["live"]
        reasons = degraded(was, now)
        if not reasons:
            return
        await emit_event(
            db,
            action=actions.EVAL_DEGRADED,
            target_kind=actions.TARGET_EVAL_SET,
            target_id=root.params.get("eval_set_id"),
            graph_id=root.graph_id,
            actor_kind=ActorKind.system,
            run_id=root.id,
            details={
                "subject": root.label,
                "trigger": root.params.get("trigger"),
                "compared_with": before.id,
                "reasons": reasons,
                "before": was,
                "after": now,
            },
        )

    # ── the gate ─────────────────────────────────────────────────────────────

    async def gate(
        self,
        db: AsyncSession,
        *,
        graph_id: str,
        subject_kind: str,
        subject_id: str,
        version: int | None = None,
        model_pin: str | None = None,
        unchanged_pin: bool = True,
        why: str | None = None,
    ) -> dict:
        """The verdict a publish, rollback or pin move reads — or the refusal.

        Returns ``{verdict, eval_run_id, warnings}`` for the publish event.
        Refuses ``409`` when the set has active cases and no settled eval run
        covers this exact candidate, while that run is still going, when a hard
        check failed on the draft side, and when it warned and no ``why`` was given.
        """
        subject = await self._require_subject(db, graph_id=graph_id, kind=subject_kind, subject_id=subject_id)
        eval_set = await self.qs.set_for(db, subject_kind=subject_kind, subject_id=subject_id)
        active = await self.qs.cases(db, eval_set_id=eval_set.id, status="active") if eval_set else []
        if not active:
            return {"verdict": "unchecked", "eval_run_id": None, "warnings": ["no eval set — nothing checked"]}
        cand = await self.candidate(
            db, subject=subject, version=version, model_pin=model_pin, unchanged_pin=unchanged_pin
        )
        subject_key = _subject(subject_kind, subject_id)
        mine = [
            r
            for r in await self.qs.runs(db, graph_id=graph_id, subject=subject_key)
            if (r.params or {}).get("candidate_digest") == cand.digest
        ]
        if not mine:
            raise ConflictError(
                {
                    "error": "eval_required",
                    "message": f"Run the evals on this {cand.kind} first — the set has {len(active)} active cases.",
                    "cases": len(active),
                }
            )
        latest = mine[0]
        if latest.status != RunStatus.succeeded.value:
            raise ConflictError({"error": "eval_running", "message": "The eval run has not settled yet."})
        g = (latest.result or {}).get("eval", {}).get("gate", {})
        if g.get("verdict") == "blocked":
            raise ConflictError({"error": "eval_failed", "message": g["reasons"][0], "eval_run_id": latest.id, **g})
        if g.get("verdict") == "warn" and not (why or "").strip():
            raise ConflictError(
                {
                    "error": "eval_warned",
                    "message": "The eval run warned — say why you are publishing past it.",
                    "eval_run_id": latest.id,
                    **g,
                }
            )
        return {"verdict": g.get("verdict", "clean"), "eval_run_id": latest.id, "warnings": g.get("reasons", [])}

    # ── drift ────────────────────────────────────────────────────────────────

    async def drift(
        self, db: AsyncSession, *, graph_id: str, trigger: str, subjects: list[tuple[str, str]] | None = None
    ) -> list[TaskRun]:
        """Open a live eval run for every set with active cases (or only ``subjects``)."""
        if trigger not in DRIFT_TRIGGERS:
            raise ValidationError(f"'{trigger}' is not a drift trigger.")
        opened = []
        for eval_set in await self.qs.sets_for_graph(db, graph_id=graph_id):
            if subjects is not None and (eval_set.subject_kind, eval_set.subject_id) not in subjects:
                continue
            if not await self.qs.cases(db, eval_set_id=eval_set.id, status="active"):
                continue
            subject = await db.get(Skill if eval_set.subject_kind == EvalSubject.skill else Agent, eval_set.subject_id)
            if subject is None or (isinstance(subject, Skill) and subject.current_version_id is None):
                continue
            opened.append(
                await self.open_run(
                    db,
                    graph_id=graph_id,
                    subject_kind=eval_set.subject_kind,
                    subject_id=eval_set.subject_id,
                    side="live",
                    actor_id=None,
                    trigger=trigger,
                )
            )
        return opened

    # ── the budget ───────────────────────────────────────────────────────────

    async def budget(self, db: AsyncSession, *, graph_id: str) -> dict:
        row = await self.qs.budget(db, graph_id=graph_id)
        spent = await self.qs.spent_since(db, graph_id=graph_id, since=_month_start())
        return {"monthly_tokens": row.monthly_tokens if row else None, "spent": spent}

    async def put_budget(self, db: AsyncSession, *, graph_id: str, monthly_tokens: int | None, actor_id: str) -> dict:
        if monthly_tokens is not None and monthly_tokens < 0:
            raise ValidationError("An eval budget is a whole number of tokens, or none.")
        row = await self.qs.budget(db, graph_id=graph_id)
        if row is None:
            row = EvalBudget(graph_id=graph_id)
            await self.qs.add(db, row)
        row.monthly_tokens = monthly_tokens
        await db.flush()
        await emit_event(
            db,
            action=actions.EVAL_BUDGET_UPDATE,
            target_kind=actions.TARGET_GRAPH,
            target_id=graph_id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"monthly_tokens": monthly_tokens},
        )
        return await self.budget(db, graph_id=graph_id)


# ── pure parts ───────────────────────────────────────────────────────────────


def _aware(at: datetime) -> datetime:
    return at if at.tzinfo else at.replace(tzinfo=UTC)


def _world_of(run: TaskRun) -> str:
    """The world a run froze, by the name it had then; *Everything* for none."""
    if not run.lens_id:
        return eval_checks.EVERYTHING
    named = [c for c in (run.lens_snapshot or {}).get("contributors") or [] if c.get("id") == run.lens_id]
    return str(named[0].get("name")) if named else "a world"


def _side_numbers(rows: list[EvalResult]) -> dict:
    hard = [v for r in rows for v in (r.hard or {}).values()]
    judged = [r.judged for r in rows if r.judged is not None]
    return {
        "cases": len(rows),
        "hard_passed": sum(1 for v in hard if v == "pass"),
        "hard_total": len(hard),
        "p95_ms": eval_checks.p95([r.latency_ms for r in rows]),
        "tokens": sum(r.tokens for r in rows),
        "judged_mean": round(sum(judged) / len(judged), 2) if judged else None,
    }


def summarize(results: list[EvalResult]) -> dict:
    """Per-side numbers, changed answers, and the gate's verdict with its reasons."""
    by_side = {s: [r for r in results if r.side == s] for s in SIDES}
    sides = {s: _side_numbers(rows) for s, rows in by_side.items() if rows}
    live_answers = {r.eval_case_id: r.answer_digest for r in by_side["live"]}
    changed = sum(
        1
        for r in by_side["draft"]
        if r.eval_case_id in live_answers and live_answers[r.eval_case_id] != r.answer_digest
    )
    reasons: list[str] = []
    verdict = "clean"
    failed = [(r.eval_case_id, k) for r in by_side["draft"] for k, v in (r.hard or {}).items() if v == "fail"]
    if failed:
        verdict = "blocked"
        reasons += [f"Case {case_id[:8]} fails {kind} on the draft." for case_id, kind in failed]
    elif "draft" in sides and "live" in sides:
        live, draft = sides["live"], sides["draft"]
        for name, label in (("tokens", "tokens"), ("p95_ms", "p95")):
            if live[name] and draft[name] > live[name] * WARN_RATIO:
                reasons.append(
                    f"{label} {draft[name]} against {live[name]} on live — over by more than {WARN_RATIO - 1:.0%}."
                )
        judged = live["judged_mean"] is not None and draft["judged_mean"] is not None
        if judged and draft["judged_mean"] <= live["judged_mean"] - WARN_JUDGED_DROP:
            reasons.append(f"Judged {draft['judged_mean']} against {live['judged_mean']} on live (labelled judge).")
        if reasons:
            verdict = "warn"
    return {"sides": sides, "changed_answers": changed, "gate": {"verdict": verdict, "reasons": reasons}}


def degraded(was: dict, now: dict) -> list[str]:
    """Why a live run is worse than the last one; empty when it is not."""
    reasons = []
    if now["hard_passed"] < was["hard_passed"]:
        reasons.append(
            f"Hard checks {now['hard_passed']}/{now['hard_total']}, from {was['hard_passed']}/{was['hard_total']}."
        )
    for name, label in (("p95_ms", "p95"), ("tokens", "tokens")):
        if was[name] and now[name] > was[name] * DEGRADED_RATIO:
            reasons.append(f"{label} {now[name]}, from {was[name]} — past {DEGRADED_RATIO}x.")
    return reasons
