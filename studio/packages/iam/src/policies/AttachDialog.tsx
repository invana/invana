/**
 * *Attach to…* — a person, a group or an agent takes the policy, for one run,
 * for N days or always. A group passes it to every member; an agent built in
 * Agents is one record, attached here or on its Access tab. A refusal — a
 * boundary, a draft, a holder already holding it — shows the engine's words in
 * place.
 */

import {
	Field,
	FieldDescription,
	FieldLabel,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	SegmentedControl,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { useState } from "react";
import {
	useGroupsQuery,
	useIamAgentsQuery,
	usePeopleQuery,
	usePolicyMutations,
} from "../queries";
import type { AttachRequest } from "../types";

type HolderKind = AttachRequest["holder_kind"];
type Ends = NonNullable<AttachRequest["ends"]>;

const EVERY = { limit: 200 };

/** Mounted only while it is open. */
export function AttachDialog({
	username,
	graphSlug,
	name,
	onClose,
}: {
	username: string;
	graphSlug: string;
	/** The policy's name. */
	name: string;
	onClose: () => void;
}) {
	const { attach } = usePolicyMutations({ username, graphSlug });
	const people = usePeopleQuery(username, graphSlug, EVERY);
	const groups = useGroupsQuery(username, graphSlug, EVERY);
	const agents = useIamAgentsQuery(username, graphSlug, EVERY);
	const [kind, setKind] = useState<HolderKind>("group");
	const [holder, setHolder] = useState("");
	const [ends, setEnds] = useState<Ends>("always");
	const [days, setDays] = useState("7");
	const [runId, setRunId] = useState("");

	const options =
		kind === "person"
			? (people.data?.items ?? []).map((p) => ({
					value: p.user_id,
					label: p.username,
				}))
			: kind === "group"
				? (groups.data?.items ?? []).map((g) => ({
						value: g.id,
						label: g.name,
					}))
				: (agents.data?.items ?? []).map((a) => ({
						value: a.agent_id,
						label: a.name,
					}));

	const dayCount = Number.parseInt(days, 10);
	const ready =
		!!holder &&
		(ends !== "days" || dayCount > 0) &&
		(ends !== "run" || !!runId.trim());

	const submit = () =>
		attach.mutate(
			{
				name,
				data: {
					holder_kind: kind,
					holder_id: holder,
					ends,
					days: ends === "days" ? dayCount : null,
					run_id: ends === "run" ? runId.trim() : null,
				},
			},
			{ onSuccess: onClose },
		);

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Attach {name} to…</DialogTitle>
					<DialogDescription>
						A group passes it to every member; an agent built in Agents can be
						attached here or on its Access tab — one record.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<Field>
						<FieldLabel>Holder</FieldLabel>
						<SegmentedControl
							size="sm"
							aria-label="Holder kind"
							value={kind}
							onValueChange={(v) => {
								setKind(v as HolderKind);
								setHolder("");
							}}
							options={[
								{ value: "person", label: "Person" },
								{ value: "group", label: "Group" },
								{ value: "agent", label: "Agent" },
							]}
						/>
						<Select value={holder} onValueChange={setHolder}>
							<SelectTrigger aria-label={`Which ${kind}`}>
								<SelectValue placeholder={`Pick a ${kind}`} />
							</SelectTrigger>
							<SelectContent>
								{options.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel>Until</FieldLabel>
						<SegmentedControl
							size="sm"
							aria-label="Until"
							value={ends}
							onValueChange={(v) => setEnds(v as Ends)}
							options={[
								{ value: "run", label: "For a run" },
								{ value: "days", label: "N days" },
								{ value: "always", label: "Always" },
							]}
						/>
						{ends === "days" ? (
							<Input
								aria-label="Days"
								type="number"
								min={1}
								className="w-24"
								value={days}
								onChange={(e) => setDays(e.target.value)}
							/>
						) : null}
						{ends === "run" ? (
							<>
								<Input
									aria-label="Run id"
									className="font-mono"
									value={runId}
									onChange={(e) => setRunId(e.target.value)}
									placeholder="the run's id"
								/>
								<FieldDescription>It ends when the run does.</FieldDescription>
							</>
						) : null}
					</Field>
					<FormError error={attach.error} />
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button disabled={!ready || attach.isPending} onClick={submit}>
						{attach.isPending ? "Attaching…" : "Attach"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
