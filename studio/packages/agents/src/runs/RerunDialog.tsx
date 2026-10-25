/**
 * **Rerun** — one dialog wherever a run is read (`&rerun=1` on the run page).
 *
 * *As a reviewer, I want to run a run again — exactly as it ran, on today's
 * versions, or with one thing changed — so that a different outcome has a
 * reason I can point at.*
 *
 * - *The same versions — reproduce it*: the versions the run recorded, shown
 *   as the engine pinned them (*not recorded* when it pinned none).
 * - *Current versions — compare*: today's versions, resolved when it opens.
 * - *Retune*: agent version · model version · run budget · world; anything
 *   left as it ran stays as the run recorded it.
 *
 * A rerun is a new run with its own number, and it opens on its own page. A
 * refusal — a version no longer offered — is shown here in the engine's words.
 */

import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Alert,
	AlertDescription,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	PropertyList,
	PropertyRow,
	SegmentedControl,
} from "@invana/ui";
import {
	type RerunRetune,
	type RerunVersions,
	useLensesQuery,
} from "@invana-studio/core";
import { RotateCw } from "lucide-react";
import { useState } from "react";
import { useOfferedVersions, versionName } from "../agents/agentParts";
import { useAgentQuery } from "../agents/queries";
import { tokens } from "../overview/fleetParts";
import { useRerunMutation } from "./queries";
import type { RunHead } from "./types";

/** A select left on this keeps what the run recorded. */
const AS_RAN = "as-ran";

const CHOICES = [
	{ value: "same", label: "The same versions", sub: "reproduce it" },
	{ value: "current", label: "Current versions", sub: "compare" },
	{ value: "retune", label: "Retune", sub: "change one thing" },
];

export function RerunDialog({
	open,
	onOpenChange,
	username,
	graphSlug,
	head,
	title,
	onRerun,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	username: string;
	graphSlug: string;
	head: RunHead;
	/** `Rerun #2291`. */
	title: string;
	/** The new run opened. */
	onRerun: (newRunId: string) => void;
}) {
	const rerun = useRerunMutation(username, graphSlug);
	const agent = useAgentQuery(
		username,
		graphSlug,
		open && head.agent_id ? head.agent_id : undefined,
	);
	const models = useOfferedVersions(username, graphSlug);
	const worlds = useLensesQuery(open ? username : undefined, graphSlug, {
		kind: "world",
	});
	const [versions, setVersions] = useState<RerunVersions>("same");
	const [agentVersion, setAgentVersion] = useState(AS_RAN);
	const [model, setModel] = useState(AS_RAN);
	const [budget, setBudget] = useState("");
	const [world, setWorld] = useState(AS_RAN);

	const latest = agent.data?.version ?? 0;
	const agentVersions = Array.from({ length: latest }, (_, i) => latest - i);

	const retune = (): RerunRetune => ({
		...(agentVersion !== AS_RAN ? { agent_version: Number(agentVersion) } : {}),
		...(model !== AS_RAN ? { model_version: model } : {}),
		...(budget.trim() ? { max_tokens_run: Number(budget) } : {}),
		...(world !== AS_RAN ? { lens_id: world } : {}),
	});

	const submit = () =>
		rerun.mutate(
			{
				runId: head.id,
				versions,
				retune: versions === "retune" ? retune() : undefined,
			},
			{
				onSuccess: (result) => {
					onOpenChange(false);
					onRerun(result.runId);
				},
			},
		);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) rerun.reset();
				onOpenChange(next);
			}}
		>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						A rerun is a new run with its own number; it opens on its own page.
					</DialogDescription>
				</DialogHeader>
				<div className="flex min-w-0 flex-col gap-3">
					<SegmentedControl
						stretch
						aria-label="Versions"
						value={versions}
						onValueChange={(v) => setVersions(v as RerunVersions)}
						options={CHOICES}
					/>
					{versions === "same" ? (
						<PropertyList labelWidth="auto" variant="summary">
							<PropertyRow label="Agent version">
								{head.agent_version != null ? (
									`${head.agent_name ?? "Agent"} v${head.agent_version}`
								) : (
									<span className="text-muted-foreground">not recorded</span>
								)}
							</PropertyRow>
							<PropertyRow label="Model version" mono={!!head.model_version}>
								{head.model_version ?? (
									<span className="text-muted-foreground">not recorded</span>
								)}
							</PropertyRow>
						</PropertyList>
					) : null}
					{versions === "retune" ? (
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="rerun-agent-version">Agent version</Label>
								<Select value={agentVersion} onValueChange={setAgentVersion}>
									<SelectTrigger id="rerun-agent-version">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={AS_RAN}>As it ran</SelectItem>
										{agentVersions.map((v) => (
											<SelectItem key={v} value={String(v)}>
												{head.agent_name ?? "Agent"} v{v}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="rerun-model-version">Model version</Label>
								<Select value={model} onValueChange={setModel}>
									<SelectTrigger id="rerun-model-version">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={AS_RAN}>As it ran</SelectItem>
										{models.versions.map((address) => {
											const name = versionName(address) ?? address;
											return (
												<SelectItem key={address} value={name}>
													{name}
												</SelectItem>
											);
										})}
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="rerun-budget">Run budget</Label>
								<div className="flex items-center gap-2">
									<Input
										id="rerun-budget"
										className="w-32"
										type="number"
										min={1}
										value={budget}
										placeholder={
											head.max_tokens_run != null
												? String(head.max_tokens_run)
												: undefined
										}
										onChange={(e: { target: { value: string } }) =>
											setBudget(e.target.value)
										}
									/>
									<span className="text-sm text-muted-foreground">
										tokens
										{head.max_tokens_run != null
											? ` · was ${tokens(head.max_tokens_run)}`
											: ""}
									</span>
								</div>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="rerun-world">World</Label>
								<Select value={world} onValueChange={setWorld}>
									<SelectTrigger id="rerun-world">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={AS_RAN}>As it ran</SelectItem>
										{(worlds.data?.items ?? []).map((lens) => (
											<SelectItem key={lens.id} value={lens.id}>
												{lens.display_name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					) : null}
					{rerun.error ? (
						<Alert variant="destructive">
							<AlertDescription>
								{rerun.error instanceof Error
									? rerun.error.message
									: "The engine refused this rerun."}
							</AlertDescription>
						</Alert>
					) : null}
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button disabled={rerun.isPending} onClick={submit}>
						<RotateCw />
						{rerun.isPending ? "Rerunning…" : "Rerun"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
