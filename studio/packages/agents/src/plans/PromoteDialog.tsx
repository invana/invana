/**
 * **Promote a plan** — the plan library's only write (docs/for-developers/modules/agents/spec.md).
 *
 * Authoring a plan from scratch is post-MVP, because a spec drives dispatch
 * and authoring one is therefore an execution surface with its own threat
 * model. Promotion is the deliberate exception, and it is safe for a reason
 * worth stating: **the plan already ran, inside an envelope, and Verify said it
 * served.** Nothing new becomes executable — a shape that already executed
 * successfully gets a key and a version so the next promotion is diffable
 * against it (docs/for-developers/modules/workflows/features/promote-a-plan.md's review stage, applied to plans).
 *
 * That is why the picker offers candidates and nothing else — a table of
 * them, one row a run, every column a field the run list returns. A free-text
 * run id, or a list including plans that failed or were never verified,
 * would quietly turn this into the authoring surface MVP does not have. The
 * entry it makes lands under Functions › Promoted plans.
 */

import { Field, FieldDescription, FieldLabel, Input } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	EmptyState,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import type { TaskRunSummary } from "@invana-studio/core";
import { ApiError } from "@invana-studio/core";
import { useRunsQuery } from "@invana-studio/shell";
import { FormError } from "@invana-studio/ui";
import { useState } from "react";
import { usePromoteFlowMutation } from "./queries";
import type { FlowDetail } from "./types";

/** `nl-compare` — a key is the contract, so it is constrained like one. */
const KEY_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;

export function PromoteDialog({
	username,
	graphSlug,
	open,
	onOpenChange,
	onPromoted,
}: {
	username: string;
	graphSlug: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The library entry it made — the caller opens it. */
	onPromoted?: (plan: FlowDetail) => void;
}) {
	const [selected, setSelected] = useState<TaskRunSummary | null>(null);
	const [key, setKey] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);

	const candidates = useRunsQuery(
		username,
		graphSlug,
		{ filters: { candidates: ["true"] }, limit: 25 },
		open,
	);
	const promote = usePromoteFlowMutation(username, graphSlug);

	const items = candidates.data?.items ?? [];
	const keyValid = KEY_PATTERN.test(key);

	const reset = () => {
		setSelected(null);
		setKey("");
		setDescription("");
		setError(null);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) reset();
				onOpenChange(next);
			}}
		>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Promote a plan</DialogTitle>
					<DialogDescription>
						A plan that already ran and served becomes a library entry, with a
						key and a version. Only plans the engine generated are offered — a
						run off a template is already in the library.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					{candidates.isLoading ? (
						<div className="flex justify-center p-4">
							<Spinner />
						</div>
					) : items.length === 0 ? (
						<EmptyState
							title="Nothing to promote yet"
							description="A candidate is a plan the engine generated, that Verify said served, and that no entry already claims."
						/>
					) : (
						<div className="max-h-56 overflow-y-auto rounded-sm border">
							<Table density="compact">
								<TableHeader>
									<TableRow>
										<TableHead className="w-full">Run</TableHead>
										<TableHead className="whitespace-nowrap">
											Plan it ran
										</TableHead>
										<TableHead>Exit</TableHead>
										<TableHead className="text-right">Steps</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{items.map((item) => {
										const isSelected = selected?.id === item.id;
										return (
											<TableRow
												key={item.id}
												className="cursor-pointer"
												data-state={isSelected ? "selected" : undefined}
												aria-selected={isSelected}
												onClick={() => {
													setSelected(item);
													setError(null);
													if (!key && item.task_title)
														setKey(slugify(item.task_title));
												}}
											>
												<TableCell className="max-w-0 truncate">
													{item.task_title ?? item.body ?? item.id}
												</TableCell>
												<TableCell className="whitespace-nowrap font-mono">
													{item.flow_key ?? "—"}
												</TableCell>
												<TableCell className="whitespace-nowrap">
													{item.outcome ?? item.status}
												</TableCell>
												<TableCell className="text-right">
													{item.step_count}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}

					{selected ? (
						<>
							<Field>
								<FieldLabel htmlFor="promote-key">Key</FieldLabel>
								<Input
									id="promote-key"
									className="font-mono"
									value={key}
									onChange={(e) => setKey(e.target.value)}
									placeholder="supplier-exposure"
								/>
								<FieldDescription>
									Lower-case, digits and dashes. Reusing an existing key adds
									the next version rather than overwriting it.
								</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor="promote-description">
									Description
								</FieldLabel>
								<Input
									id="promote-description"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="What this plan does, in one line."
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="promote-origin">Origin</FieldLabel>
								<Input id="promote-origin" value="promoted" readOnly />
							</Field>
						</>
					) : null}

					<FormError error={error} />
				</div>

				<DialogFooter>
					<Button
						variant="ghost"
						onClick={() => {
							reset();
							onOpenChange(false);
						}}
					>
						Cancel
					</Button>
					<Button
						disabled={!selected || !keyValid || promote.isPending}
						onClick={() => {
							if (!selected) return;
							setError(null);
							promote.mutate(
								{
									run_id: selected.id,
									key: key.trim(),
									description: description.trim() || undefined,
								},
								{
									onSuccess: (plan) => {
										reset();
										onOpenChange(false);
										onPromoted?.(plan);
									},
									onError: (err) =>
										setError(
											err instanceof ApiError
												? err.message
												: "That plan could not be promoted.",
										),
								},
							);
						}}
					>
						{promote.isPending ? "Promoting…" : "Promote"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 63);
}
