/**
 * An agent › **Access** (board `agents.agent.access`): what is enforced today,
 * and who it may hand work to.
 *
 * *As a builder, I want to see which policies this agent holds, which
 * functions it may call and why one is refused, so that a refusal at run time
 * is never a surprise.*
 *
 * - **Policies it holds** and **Functions** are IAM's — the host's
 *   `AccessPanel` slot, the same reading IAM's agent page draws.
 * - **May delegate to** — `policy.may_delegate`, each of the Graph's other
 *   agents at *always* · *ask each time* · *never*. An agent the map does not
 *   name is asked about each time, which is why every agent is listed rather
 *   than only the named ones. Edits ride the page's buffer; Save writes them.
 */

import {
	Badge,
	SegmentedControl,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useAccess } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { useAgentsSlots } from "../AgentsSlots";
import type { AgentDraft } from "./agentDraft";
import { TabReadState } from "./agentParts";
import { useAgentsQuery } from "./queries";
import type { Agent, Delegate } from "./types";

const DELEGATE: { value: Delegate; label: string }[] = [
	{ value: "always", label: "always" },
	{ value: "ask", label: "ask each time" },
	{ value: "never", label: "never" },
];

const DELEGATE_TONE = {
	always: "success",
	ask: "warning",
	never: "muted",
} as const;

export function AgentAccessTab({
	username,
	graphSlug,
	agent,
	onOpenEnvelope,
	draft,
	onPatch,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	onOpenEnvelope: () => void;
	/** The page's edit buffer; without it *May delegate to* is read-only. */
	draft?: AgentDraft;
	onPatch?: (next: Partial<AgentDraft>) => void;
}) {
	const { AccessPanel } = useAgentsSlots();

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<AccessPanel
				username={username}
				graphSlug={graphSlug}
				agent={{ id: agent.id, name: agent.name }}
				onOpenEnvelope={onOpenEnvelope}
			/>
			<MayDelegateTo
				username={username}
				graphSlug={graphSlug}
				agent={agent}
				draft={draft}
				onPatch={onPatch}
			/>
		</div>
	);
}

/** Which of the Graph's other agents this one may hand work to, and how. */
function MayDelegateTo({
	username,
	graphSlug,
	agent,
	draft,
	onPatch,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	draft?: AgentDraft;
	onPatch?: (next: Partial<AgentDraft>) => void;
}) {
	const agents = useAgentsQuery(username, graphSlug);
	const build = useAccess().gate("build");
	const editable =
		Boolean(draft && onPatch) && build.allowed && agent.status !== "retired";
	const listed = (draft?.policy ?? agent.policy)?.may_delegate ?? {};
	const others = (agents.data?.items ?? []).filter((a) => a.id !== agent.id);

	const set = (id: string, mode: Delegate) => {
		if (!draft || !onPatch) return;
		onPatch({
			policy: { ...draft.policy, may_delegate: { ...listed, [id]: mode } },
		});
	};

	return (
		<PanelSection card title="May delegate to">
			{!agents.data ? (
				<TabReadState
					loading={agents.isLoading}
					error={agents.error}
					what="the agents it may delegate to"
					onRetry={() => void agents.refetch()}
				/>
			) : others.length ? (
				<Table bordered={false}>
					<TableHeader>
						<TableRow>
							<TableHead>Agent</TableHead>
							<TableHead>Kind</TableHead>
							<TableHead>May delegate</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{others.map((a) => {
							const mode = listed[a.id] ?? "ask";
							return (
								<TableRow key={a.id}>
									<TableCell className="font-medium">{a.name}</TableCell>
									<TableCell className="text-muted-foreground">
										{a.kind}
									</TableCell>
									<TableCell>
										{editable ? (
											<SegmentedControl
												size="sm"
												aria-label={`May delegate to ${a.name}`}
												value={mode}
												onValueChange={(v) => set(a.id, v as Delegate)}
												options={DELEGATE}
											/>
										) : (
											<Badge
												size="xs"
												variant="soft"
												tone={DELEGATE_TONE[mode]}
											>
												{DELEGATE.find((d) => d.value === mode)?.label}
											</Badge>
										)}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			) : (
				<p className="text-muted-foreground">
					No other agent in this Graph to delegate to.
				</p>
			)}
		</PanelSection>
	);
}
