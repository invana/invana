/**
 * A function's page — board `agents.functions.detail`, `task_type:<key>` in
 * `mainSection` ([the-catalogue.md](docs/for-developers/modules/workflows/features/the-catalogue.md)).
 *
 * *As a builder, I want a function's contract, who names it and how its calls
 * went, so that a plan step naming it holds no surprises.*
 *
 * A page head — crumbed `Functions › <key>`, with its bound, its side effect
 * and its plugin `name@version` — over three tabs:
 *
 * | Tab | What it answers |
 * |---|---|
 * | **Contract** | arguments, returns with each fan-out rule, *Must come after*, *Runs as*; beside them *Calls · 30 days* and *Needed by skills* |
 * | **Used by** | the reusable plans that name it and the skills that need it |
 * | **Calls** | the run steps that called it, newest first |
 *
 * The open tab is `?tab=`, written on every switch, so a link or a reload
 * opens the same tab. Everything is read from `GET …/catalogue/{key}` in this
 * Graph: the contract is the declaration, never a second copy, and every
 * number is the engine's. Read-only — nothing here runs, edits or disables a
 * function.
 */

import {
	BoundChip,
	EmptyState,
	RecordHeader,
	Spinner,
	TabbedPanel,
} from "@invana/ui";
import { useUpdateSearchParams } from "@invana-studio/core";
import { DetailStatus } from "@invana-studio/ui";
import { useContext } from "react";
import { useSearchParams } from "react-router-dom";
import { AgentsOpenContext } from "../open";
import { FleetReadState } from "../overview/fleetParts";
import { SECTIONS } from "../sections/spec";
import { CallsTab } from "./function/CallsTab";
import { ContractTab } from "./function/ContractTab";
import { UsedByTab } from "./function/UsedByTab";
import { useFunctionQuery } from "./queries";

const FUNCTION_TABS = ["contract", "used_by", "calls"] as const;

export type FunctionTab = (typeof FUNCTION_TABS)[number];

const isTab = (v: string | null): v is FunctionTab =>
	!!v && (FUNCTION_TABS as readonly string[]).includes(v);

/** The open tab, read from and written to `?tab=`; other params are kept. */
function useFunctionTab(): [FunctionTab, (tab: FunctionTab) => void] {
	const [params] = useSearchParams();
	const update = useUpdateSearchParams();
	const raw = params.get("tab");
	const tab = isTab(raw) ? raw : "contract";
	const setTab = (next: FunctionTab) =>
		update((prev) => {
			const out = new URLSearchParams(prev);
			out.set("tab", next);
			return out;
		});
	return [tab, setTab];
}

const FunctionIcon = SECTIONS.functions.icon;

export function FunctionPage({
	taskKey,
	username,
	graphSlug,
	onOpenPlugin,
	onOpenFunction,
}: {
	taskKey: string;
	/** The Graph whose plans, skills and runs the page reads. */
	username?: string;
	graphSlug?: string;
	/** Opens the declaring plugin; defaults to the Agents opener. */
	onOpenPlugin?: (name: string) => void;
	/** Opens a function this one must come after; defaults to the Agents opener. */
	onOpenFunction?: (key: string) => void;
}) {
	const query = useFunctionQuery(username, graphSlug, taskKey);
	const opener = useContext(AgentsOpenContext);
	const [tab, setTab] = useFunctionTab();
	const fn = query.data;

	if (!username || !graphSlug)
		return (
			<EmptyState
				className="h-full"
				title="Open it from a Graph"
				description="A function's page reads who names it and how its calls went in one Graph."
			/>
		);
	if (query.isLoading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (!fn) {
		const status = (query.error as { status?: number } | null)?.status;
		return status === 404 || !query.error ? (
			<EmptyState
				className="h-full"
				title="No such function"
				description={`No loaded plugin declares "${taskKey}". A plan naming it cannot run.`}
			/>
		) : (
			<div className="p-3.5">
				<FleetReadState
					loading={false}
					error={query.error}
					what="this function"
				/>
			</div>
		);
	}

	const openPlugin = onOpenPlugin ?? opener?.plugin;
	const openFunction = onOpenFunction ?? opener?.func;

	const tabs: {
		value: FunctionTab;
		label: string;
		content: React.ReactNode;
	}[] = [
		{
			value: "contract",
			label: "Contract",
			content: (
				<ContractTab
					fn={fn}
					onOpenFunction={openFunction}
					onOpenSkill={opener?.skill}
					onOpenPlugin={openPlugin}
				/>
			),
		},
		{
			value: "used_by",
			label: "Used by",
			content: (
				<UsedByTab
					fn={fn}
					onOpenPlan={opener?.plan}
					onOpenSkill={opener?.skill}
				/>
			),
		},
		{
			value: "calls",
			label: "Calls",
			content: (
				<CallsTab
					username={username}
					graphSlug={graphSlug}
					stepKey={fn.step_key}
					onOpenRun={opener?.run}
				/>
			),
		},
	];

	return (
		// `h-full`: the page host is not a flex column, so without it the page
		// grows to its content and the header and tabs scroll away with it.
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				icon={<FunctionIcon />}
				crumbs={[
					opener
						? {
								label: SECTIONS.functions.label,
								onClick: () => opener.section("functions"),
							}
						: SECTIONS.functions.label,
					fn.step_key,
				]}
				chips={
					<>
						<BoundChip bound={fn.bound} />
						<DetailStatus>{fn.side_effect}</DetailStatus>
						<DetailStatus className="font-mono">{fn.plugin}</DetailStatus>
					</>
				}
			/>
			{/* The kit's underline strip; the page owns the border. */}
			<TabbedPanel
				className="min-h-0 flex-1 border-0 bg-transparent shadow-none"
				bodyClassName="@container"
				overflow
				activeTab={tab}
				onTabChange={(v) => setTab(isTab(v) ? v : "contract")}
				tabs={tabs}
			/>
		</div>
	);
}
