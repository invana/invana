/**
 * *Save name? policy · vN* — the version the engine says the save writes
 * (a draft's first save writes v1) — and what saving these statements and limits would change, before
 * anything does. The engine compares each holder (the agents, the people, and
 * the members of holding groups) with what it may do today: who gains, who
 * loses which action on which resource and how often it used it in the last
 * 30 days, and every bound skill whose needs would stop being covered.
 *
 * *Cancel* keeps the draft as it is; *Save anyway* (or *Save*, when nothing is
 * lost or broken) saves.
 */

import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { Check, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { useImpactMutation } from "../queries";
import type { ImpactRequest, PolicyRead } from "../types";

const CHANGE_TONE = {
	gains: "success",
	loses: "destructive",
	same: "muted",
} as const;

/** Mounted only while it is open. */
export function ImpactDialog({
	username,
	graphSlug,
	policy,
	candidate,
	saving,
	saveError,
	onCancel,
	onSave,
}: {
	username: string;
	graphSlug: string;
	policy: PolicyRead;
	/** The statements and limits that would be saved. */
	candidate: ImpactRequest;
	saving: boolean;
	saveError: Error | null;
	onCancel: () => void;
	onSave: () => void;
}) {
	const impact = useImpactMutation({ username, graphSlug });
	const { mutate } = impact;
	// One reading per opening: the candidate is fixed while the modal is up.
	// biome-ignore lint/correctness/useExhaustiveDependencies: read once on open
	useEffect(() => {
		mutate({ name: policy.name, data: candidate });
	}, []);
	const read = impact.data;
	const risky =
		!!read &&
		(read.breaks.length > 0 || read.rows.some((r) => r.change === "loses"));

	return (
		<Dialog open onOpenChange={(o) => !o && onCancel()}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						Save {policy.name}?{" "}
						<span className="font-normal text-muted-foreground">
							{read ? `policy · v${read.writes_version}` : "policy"}
						</span>
					</DialogTitle>
					<DialogDescription>
						{read
							? `${read.holders_line}. Compared with what they can do today:`
							: "Comparing with what its holders can do today…"}
					</DialogDescription>
				</DialogHeader>
				{impact.isPending ? (
					<div className="flex justify-center p-6">
						<Spinner />
					</div>
				) : impact.error ? (
					<FormError error={impact.error} />
				) : read ? (
					<div className="flex flex-col gap-3">
						{read.rows.length ? (
							<Table aria-label="Impact">
								<TableHeader>
									<TableRow>
										<TableHead>Holder</TableHead>
										<TableHead className="w-20" />
										<TableHead>Resource</TableHead>
										<TableHead>Used</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{read.rows.map((r, i) => (
										<TableRow
											// biome-ignore lint/suspicious/noArrayIndexKey: one holder may gain and lose
											key={`${r.holder_id}-${i}`}
										>
											<TableCell className="font-medium">{r.name}</TableCell>
											<TableCell>
												<Badge variant="soft" tone={CHANGE_TONE[r.change]}>
													{r.change}
												</Badge>
											</TableCell>
											<TableCell className="font-mono">{r.what}</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{r.used_line}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						) : (
							<p className="text-muted-foreground">
								Nobody holds it yet — saving changes no one's access.
							</p>
						)}
						{read.breaks.map((b) => (
							<Alert key={`${b.agent_id}-${b.skill_id}`} tone="destructive">
								<TriangleAlert className="size-4" />
								<AlertDescription>{b.line}</AlertDescription>
							</Alert>
						))}
					</div>
				) : null}
				<FormError error={saveError} />
				<DialogFooter>
					<Button variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
					<Button disabled={!read || saving} onClick={onSave}>
						<Check />
						{saving ? "Saving…" : risky ? "Save anyway" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
