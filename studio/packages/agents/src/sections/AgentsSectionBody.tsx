/**
 * The body of one Agents section tab — the section key picks the page, and
 * every page takes the same props from the host. Home has no tab: the host
 * draws it when nothing is open.
 */

import { AgentsListPage } from "../agents/AgentsListPage";
import { ApprovalsPage } from "../approvals/ApprovalsPage";
import { ConnectionsSectionPage } from "../connections/ConnectionsSectionPage";
import { FleetSectionPage } from "../fleet/FleetSectionPage";
import { FunctionsSectionPage } from "../functions/FunctionsSectionPage";
import { LedgerPage } from "../ledger/LedgerPage";
import { LlmsPage } from "../llms/LlmsPage";
import { PerformancePage } from "../performance/PerformancePage";
import { RunsListPage } from "../runs/RunsListPage";
import { SettingsSectionPage } from "../settings/SettingsSectionPage";
import { SkillsListPage } from "../skills/SkillsListPage";
import { WorkersSectionPage } from "../workers/WorkersSectionPage";
import type { AgentsSectionKey, SectionPageProps } from "./spec";

const PAGES = {
	fleet: FleetSectionPage,
	performance: PerformancePage,
	agents: AgentsListPage,
	skills: SkillsListPage,
	functions: FunctionsSectionPage,
	connections: ConnectionsSectionPage,
	llms: LlmsPage,
	runs: RunsListPage,
	workers: WorkersSectionPage,
	approvals: ApprovalsPage,
	ledger: LedgerPage,
	concurrency: SettingsSectionPage,
} satisfies Record<
	Exclude<AgentsSectionKey, "home">,
	(props: SectionPageProps) => unknown
>;

export function AgentsSectionBody({
	section,
	...props
}: SectionPageProps & { section: Exclude<AgentsSectionKey, "home"> }) {
	const Page = PAGES[section];
	return <Page {...props} />;
}
