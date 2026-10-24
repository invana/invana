/**
 * An agent › **Model** (board `agents.agent.model`): the version it thinks
 * with, and every version it has run on.
 *
 * A pin names an exact version from the Graph's endpoints, so a provider's new
 * release changes nothing until a person moves it. Picking another version
 * opens *Move to …*: its eval cases run against the new version first, and the
 * move is a `PATCH model_pin` with a reason, gated by those evals. *Versions it
 * has run on* is the engine's grouping of this agent's runs by the recorded
 * model version. Effort is a set of limits (steps, replans, questions) and is
 * edited on Limits.
 */

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Badge,
	Button,
	PropertyList,
	PropertyRow,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { ActButton, useAccess } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { ArrowRight, Play } from "lucide-react";
import { useState } from "react";
import { GatedActDialog } from "../evals/GatedActDialog";
import { useEvalMutations } from "../evals/queries";
import { day, ms, pct } from "../overview/fleetParts";
import { effortSummary } from "./agentDraft";
import {
	type AgentTab,
	TabReadState,
	useOfferedVersions,
	versionName,
} from "./agentParts";
import { useAgentMutations, useAgentOverviewQuery } from "./queries";
import type { Agent } from "./types";

export function AgentModelTab({
	username,
	graphSlug,
	agent,
	onGoTo,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	onGoTo: (tab: AgentTab) => void;
}) {
	const { versions, isLoading } = useOfferedVersions(username, graphSlug);
	const m = useAgentMutations(username, graphSlug);
	const evals = useEvalMutations(username, graphSlug, "agent", agent.id);
	const build = useAccess().gate("build");
	const [picked, setPicked] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	const moving = picked && picked !== agent.model_pin ? picked : null;
	const close = () => {
		m.pin.reset();
		setConfirming(false);
		setPicked(null);
	};
	const runEvals = () =>
		evals.open.mutate({ model_pin: moving, side: "draft", trigger: "pin" });

	return (
		<div className="grid items-start gap-2.5 p-3.5 @[760px]:grid-cols-2">
			<div className="flex min-w-0 flex-col gap-2.5">
				<PanelSection card title="Model version">
					<div className="flex flex-col gap-1.5">
						<span id="agent-pinned-label">Pinned</span>
						<Select
							value={moving ?? agent.model_pin ?? ""}
							disabled={!build.allowed || agent.status === "retired"}
							onValueChange={setPicked}
						>
							<SelectTrigger
								aria-labelledby="agent-pinned-label"
								className="font-mono"
							>
								<SelectValue placeholder="None — the world's cast decides" />
							</SelectTrigger>
							<SelectContent>
								{versions.map((v) => (
									<SelectItem key={v} value={v} className="font-mono">
										{v}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-sm text-muted-foreground">
							{versions.length === 0 && !isLoading
								? "No endpoint offers a model yet — add one under LLMs."
								: "Only an offered version can be pinned."}
						</p>
					</div>
					<PropertyList className="mt-2">
						<PropertyRow label="Effort">
							<span className="flex items-center gap-2">
								<span className="min-w-0 flex-1 truncate">
									{effortSummary(agent.effective_effort)}
								</span>
								<Button
									variant="link"
									size="sm"
									className="h-auto p-0"
									onClick={() => onGoTo("limits")}
								>
									Limits <ArrowRight />
								</Button>
							</span>
						</PropertyRow>
					</PropertyList>
				</PanelSection>

				{moving ? (
					<PanelSection card title={`Move to ${versionName(moving)}`}>
						<p>
							A move is a change: its eval cases run against the new version
							first; it publishes only if they hold.
						</p>
						<div className="mt-2 flex items-center gap-1.5">
							<ActButton
								area="build"
								size="sm"
								variant="outline"
								disabled={evals.open.isPending}
								onClick={runEvals}
							>
								<Play /> Run the evals
							</ActButton>
							<ActButton
								area="build"
								size="sm"
								onClick={() => setConfirming(true)}
							>
								Move to {moving}
							</ActButton>
							<Button size="sm" variant="ghost" onClick={close}>
								Cancel
							</Button>
						</div>
					</PanelSection>
				) : null}
			</div>

			<VersionsRunOn username={username} graphSlug={graphSlug} agent={agent} />

			<GatedActDialog
				open={confirming && !!moving}
				title={`Pin ${agent.name} to ${moving}`}
				description="Its next run thinks with this version; a run in flight finishes on the old one."
				confirm={`Pin ${moving}`}
				pending={m.pin.isPending}
				error={m.pin.error}
				onConfirm={(why) =>
					m.pin.mutate(
						{ id: agent.id, modelPin: moving as string, why },
						{ onSuccess: close },
					)
				}
				onClose={close}
				onRunEvals={runEvals}
				runningEvals={evals.open.isPending}
			/>
		</div>
	);
}

function VersionsRunOn({
	username,
	graphSlug,
	agent,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
}) {
	const query = useAgentOverviewQuery(username, graphSlug, agent.id, "30d");
	const models = query.data?.models ?? [];
	return (
		<PanelSection card title="Versions it has run on">
			{!query.data ? (
				<TabReadState
					loading={query.isLoading}
					error={query.error}
					what="the versions it ran on"
				/>
			) : models.length ? (
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Version</TableHead>
							<TableHead>From</TableHead>
							<TableHead>Runs</TableHead>
							<TableHead>Served</TableHead>
							<TableHead>p95</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{models.map((v) => (
							<TableRow key={v.model_version}>
								<TableCell>
									<Badge
										variant="outline"
										tone="muted"
										size="xs"
										className="font-mono font-normal"
									>
										{v.model_version}
									</Badge>
								</TableCell>
								<TableCell className="whitespace-nowrap">
									{v.first_at ? day(v.first_at) : "—"}
								</TableCell>
								<TableCell className="font-mono">{v.runs}</TableCell>
								<TableCell className="font-mono">
									{pct(v.served_rate)}
								</TableCell>
								<TableCell className="font-mono">{ms(v.p95_ms)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : (
				<p className="text-muted-foreground">Not run yet.</p>
			)}
		</PanelSection>
	);
}
