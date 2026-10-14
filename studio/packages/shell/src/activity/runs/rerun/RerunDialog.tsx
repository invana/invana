/**
 * Re-running a settled ask — on the versions it ran with, or on today's.
 *
 * *As someone reading an answer that has since aged, I want to run the same
 * ask again — exactly as it ran, or on what the Graph uses now — so that a
 * changed answer has a reason I can point at.*
 *
 * **Ran with shows what the run recorded, nothing else**: the model version
 * (or *not recorded*; a `ql` run calls no model), the agent and its version,
 * the world as frozen at open. A version the run did not record is not drawn,
 * and *current* names no versions ahead of time, because they are resolved
 * when the new run opens.
 *
 * The request is `POST …/runs/{id}/rerun {versions}`. The original is never
 * touched: a re-run is a new root run linked to it. A refusal — a recorded
 * version no longer offered — is shown here, in the engine's own words, rather
 * than as a toast that closes the dialog it was about.
 */

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
	Eyebrow,
	PropertyList,
	PropertyRow,
	SegmentedControl,
	Spinner,
} from "@invana/ui";
import {
	formatShortDateTime,
	type RerunVersions,
	type TraceRead,
} from "@invana-studio/core";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useActivitySlots } from "../../ActivitySlots";
import { runAddress } from "../boards/runBoards";
import { useRerunMutation, useRunRecordQuery } from "../queries";
import { rerunChoices } from "./rerunChoice";

export interface RerunDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	username: string;
	graphSlug: string;
	/** The run being re-run — its trace is what *Ran with* reads. */
	trace: TraceRead;
	/** The new run opened; `versions` is what it was asked on. */
	onRerun: (newRunId: string, versions: RerunVersions) => void;
}

export function RerunDialog({
	open,
	onOpenChange,
	username,
	graphSlug,
	trace,
	onRerun,
}: RerunDialogProps) {
	const runId = trace.run_id;
	const record = useRunRecordQuery(username, graphSlug, runId);
	const agents = useActivitySlots().useAgents(username, graphSlug);
	const rerun = useRerunMutation(username, graphSlug);
	const askKind = trace.ask_kind ?? record.data?.askKind;
	const modelVersion = record.data?.modelVersion;
	const { sameDisabled, initial } = rerunChoices(askKind, modelVersion);
	const [versions, setVersions] = useState<RerunVersions>(initial);

	// Opening reads the record afresh — a run that settled while its page was
	// open has a model version its first read did not — and starts from the
	// choice that record allows, with no refusal left over from last time.
	const { refetch } = record;
	const { reset } = rerun;
	useEffect(() => {
		if (!open) return;
		void refetch();
		reset();
	}, [open, refetch, reset]);
	useEffect(() => {
		if (open) setVersions(initial);
	}, [open, initial]);

	const agentName = trace.agent_id
		? agents.data?.items.find((a) => a.id === trace.agent_id)?.name
		: undefined;
	const agentLabel = trace.agent_id
		? `${agentName ?? "agent"}${trace.agent_version ? ` v${trace.agent_version}` : ""}`
		: null;
	const model =
		modelVersion ?? (askKind === "ql" ? "calls no model" : "not recorded");
	const when = trace.started_at ?? trace.finished_at;

	const submit = () =>
		rerun.mutate(
			{ runId, versions },
			{ onSuccess: (result) => onRerun(result.runId, versions) },
		);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Re-run “{trace.body ?? runId}”</DialogTitle>
					<DialogDescription>
						{runAddress(runId)}
						{when ? ` · ${formatShortDateTime(new Date(when))}` : ""}
					</DialogDescription>
				</DialogHeader>

				<Eyebrow>Ran with</Eyebrow>
				{record.isLoading ? (
					<Spinner />
				) : (
					<PropertyList labelWidth="auto">
						<PropertyRow label="model" mono={Boolean(modelVersion)}>
							{model}
						</PropertyRow>
						{agentLabel ? (
							<PropertyRow label="agent">{agentLabel}</PropertyRow>
						) : null}
						<PropertyRow label="world">
							{trace.lens_name ?? "Everything"}
						</PropertyRow>
					</PropertyList>
				)}

				<Eyebrow>Re-run on</Eyebrow>
				<SegmentedControl
					aria-label="Re-run on"
					options={[
						{
							value: "same",
							label: "The same versions — reproduce it",
							disabled: Boolean(sameDisabled),
						},
						{ value: "current", label: "Current versions — compare" },
					]}
					value={versions}
					onValueChange={(v) => setVersions(v as RerunVersions)}
					stretch
				/>
				{sameDisabled ? (
					<p className="text-sm text-muted-foreground">{sameDisabled}</p>
				) : null}
				{versions === "current" ? (
					<p className="text-sm text-muted-foreground">
						Re-running on current versions reads today's pins and the Graph's
						models, and opens the comparison when it finishes.
					</p>
				) : null}

				{rerun.error ? (
					<Alert tone="destructive">
						<AlertDescription>{rerun.error.message}</AlertDescription>
					</Alert>
				) : null}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={submit}
						disabled={
							rerun.isPending || (versions === "same" && Boolean(sameDisabled))
						}
					>
						{rerun.isPending ? <Spinner /> : <Play />}
						Re-run
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
