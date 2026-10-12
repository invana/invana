"""Project reports — drafted from the records, edited, published as frozen versions
(docs/for-developers/modules/work/features/project-reports.md).

The draft is written by a template over the records — question, branches,
evidence by stance, verdicts and decisions, in the project type's words — so
nothing in it is invented. A person edits it; publishing freezes the body and
the dataset versions the project's findings cite. A version read names every
cited dataset version retracted since; that notice is read, never stored.

Usage::

    reports = ReportManager()
    await reports.generate(session, project=p, actor=u)
    version = await reports.publish(session, project=p, actor=u)
    read = await reports.version(session, project=p, number=version.version)
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.datasets.managers import DatasetManager
from invana.apps.work.managers.branch import BranchManager
from invana.apps.work.managers.decision import DecisionManager
from invana.apps.work.managers.project import ProjectManager
from invana.apps.work.models import Project, ProjectReport, ProjectReportVersion
from invana.apps.work.project_types import vocabulary
from invana.apps.work.querysets import ProjectFindingQuerySet, ProjectReportQuerySet
from invana.apps.work.schemas import ReportRead, ReportVersionRead, ReportVersionSummary
from invana.core.auth.models import User
from invana.core.errors import NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event

_STANCES = (("supports", "For"), ("contradicts", "Against"), ("context", "Context"))


class ReportManager:
    """Stateless. The session is the first argument of every method."""

    reports_qs = ProjectReportQuerySet()
    findings_qs = ProjectFindingQuerySet()
    projects = ProjectManager()
    branches = BranchManager()
    decisions = DecisionManager()
    datasets = DatasetManager()

    async def _report(self, session: AsyncSession, project: Project) -> ProjectReport:
        report = await self.reports_qs.for_project(session, project_id=project.id)
        if report is None:
            report = await self.reports_qs.add(session, ProjectReport(project_id=project.id))
        return report

    async def read(self, session: AsyncSession, *, project: Project) -> ReportRead:
        report = await self.reports_qs.for_project(session, project_id=project.id)
        if report is None:
            return ReportRead(project_key=project.key, draft="")
        versions = await self.reports_qs.versions(session, report_id=report.id)
        return ReportRead(
            project_key=project.key,
            draft=report.draft,
            draft_updated_by_id=report.draft_updated_by_id,
            draft_updated_at=report.draft_updated_at,
            versions=[ReportVersionSummary.model_validate(v) for v in versions],
        )

    async def draft_from_records(self, session: AsyncSession, *, project: Project) -> str:
        """The report as the records say it — Markdown, in the type's words."""
        words = vocabulary(project.type)
        lines = [f"# {project.name}", ""]
        if project.question:
            lines += [f"**Question.** {project.question}", ""]
        if project.description:
            lines += [project.description, ""]
        for branch in await self.branches.list(session, project=project):
            row = await self.branches.get(session, project=project, number=branch.number)
            lines += [f"## {words.branch} {branch.number}: {branch.title}", "", f"Status: {branch.status}.", ""]
            findings = await self.branches.findings(session, branch=row)
            for stance, heading in _STANCES:
                group = [f for f in findings if f.stance == stance]
                if not group:
                    continue
                lines += [f"### {heading}", ""]
                for finding in group:
                    cites = ", ".join(c.ref for c in finding.cites)
                    lines.append(f"- f{finding.number}. {finding.statement}" + (f" ({cites})" if cites else ""))
                lines.append("")
            for decision in await self.decisions.list_for_branch(session, project=project, branch=row):
                head = f"d{decision.number}: {decision.verdict_label} · {decision.choice_label}"
                if decision.supersedes_number:
                    head += f" (supersedes d{decision.supersedes_number})"
                lines += [f"**Decision {head}.** {decision.rationale}", ""]
        return "\n".join(lines).rstrip() + "\n"

    async def generate(self, session: AsyncSession, *, project: Project, actor: User) -> ReportRead:
        """Replace the draft with one drawn from the records. Published versions are untouched."""
        self.projects.require_writable(project)
        report = await self._report(session, project)
        report.draft = await self.draft_from_records(session, project=project)
        report.draft_updated_by_id = actor.id
        report.draft_updated_at = datetime.now(UTC)
        await session.flush()
        await self._event(session, actions.REPORT_GENERATE, project, actor, {})
        return await self.read(session, project=project)

    async def edit(self, session: AsyncSession, *, project: Project, draft: str, actor: User) -> ReportRead:
        self.projects.require_writable(project)
        report = await self._report(session, project)
        report.draft = draft
        report.draft_updated_by_id = actor.id
        report.draft_updated_at = datetime.now(UTC)
        await session.flush()
        return await self.read(session, project=project)

    async def publish(self, session: AsyncSession, *, project: Project, actor: User) -> ProjectReportVersion:
        """Freeze the draft and the dataset versions the project's findings cite."""
        self.projects.require_writable(project)
        report = await self._report(session, project)
        if not report.draft.strip():
            raise ValidationError("The draft is empty — generate or write it before publishing.")
        cites: dict[str, str] = {}
        for finding in await self.findings_qs.list_for_project(session, project_id=project.id):
            for cite in finding.cites:
                if cite.get("kind") == "dataset" and cite.get("version_id"):
                    cites[cite["version_id"]] = cite["ref"]
        version = ProjectReportVersion(
            report_id=report.id,
            version=await self.reports_qs.next_version(session, report_id=report.id),
            body=report.draft,
            cites=[{"ref": ref, "version_id": vid} for vid, ref in sorted(cites.items(), key=lambda kv: kv[1])],
            published_by_id=actor.id,
        )
        await self.reports_qs.add(session, version)
        await self._event(session, actions.REPORT_PUBLISH, project, actor, {"version": version.version})
        return version

    async def version(self, session: AsyncSession, *, project: Project, number: int) -> ReportVersionRead:
        report = await self.reports_qs.for_project(session, project_id=project.id)
        row = await self.reports_qs.version(session, report_id=report.id, version=number) if report else None
        if row is None:
            raise NotFoundError(f"Version {number} of the '{project.key}' report not found.")
        read = ReportVersionRead.model_validate(row)
        versions = await self.datasets.versions_qs.by_ids(session, [c["version_id"] for c in row.cites])
        retracted = {v.id for v in versions if v.retracted_at is not None}
        read.retracted = sorted(c["ref"] for c in row.cites if c["version_id"] in retracted)
        return read

    @staticmethod
    async def _event(session: AsyncSession, action: str, project: Project, actor: User, details: dict) -> None:
        await emit_event(
            session,
            action=action,
            target_kind=actions.TARGET_PROJECT,
            target_id=project.id,
            graph_id=project.graph_id,
            project_id=project.id,
            actor_id=actor.id,
            details={"key": project.key, **details},
        )
