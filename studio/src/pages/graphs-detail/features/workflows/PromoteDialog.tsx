/**
 * **Promote a plan** — the workflow library's only write (docs/for-developers/modules/agents/spec.md,
 * journey J6).
 *
 * Authoring a workflow from scratch is post-MVP, because a spec drives dispatch
 * and authoring one is therefore an execution surface with its own threat
 * model. Promotion is the deliberate exception, and it is safe for a reason
 * worth stating: **the plan already ran, inside an envelope, and Verify said it
 * served.** Nothing new becomes executable — a shape that already executed
 * successfully gets a key and a version so the next promotion is diffable
 * against it (docs/for-developers/modules/workflows/features/promote-a-plan.md's review stage, applied to plans).
 *
 * That is why the picker offers candidates and nothing else. A free-text
 * run id, or a list including plans that failed or were never verified,
 * would quietly turn this into the authoring surface MVP does not have.
 */

import {
	usePromoteWorkflowMutation,
	useRunsQuery,
} from "@/hooks/queries/useWork";
import { DetailStatus } from "@/pages/graphs-detail/shared/DetailRows";
import { ApiError } from "@/services/api/client";
import type { TaskRunSummary } from "@/types/work";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Spinner,
	cn,
} from "@invana/ui";
import { useState } from "react";

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
	onPromoted?: (key: string) => void;
}) {
	const [selected, setSelected] = useState<TaskRunSummary | null>(null);
	const [key, setKey] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);

	const candidates = useRunsQuery(
		username,
		graphSlug,
		{ candidates: true, limit: 25 },
		open,
	);
	const promote = usePromoteWorkflowMutation(username, graphSlug);

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
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Promote a plan</DialogTitle>
					<DialogDescription>
						A plan that already ran and served becomes a library entry, with a
						key and a version. Only plans the engine generated are offered — a
						run off a template is already in the library.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<div className="max-h-56 overflow-y-auto rounded-sm border">
						{candidates.isLoading ? (
							<div className="p-4">
								<Spinner />
							</div>
						) : items.length === 0 ? (
							<p className="p-4 text-base text-muted-foreground">
								Nothing to promote yet. A candidate is a plan the engine
								generated, that Verify said served, and that no entry already
								claims.
							</p>
						) : (
							items.map((item) => (
								<button
									key={item.id}
									type="button"
									onClick={() => {
										setSelected(item);
										setError(null);
										if (!key && item.task_title)
											setKey(slugify(item.task_title));
									}}
									className={cn(
										"flex w-full items-start gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-accent",
										selected?.id === item.id && "bg-accent",
									)}
								>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-base text-foreground">
											{item.task_title ?? item.workflow_key}
										</span>
										<span className="block truncate text-base text-muted-foreground">
											generated · {item.step_count} step
											{item.step_count === 1 ? "" : "s"}
											{item.replans
												? ` · ${item.replans} replan${item.replans === 1 ? "" : "s"}`
												: ""}
											{item.finished_at
												? ` · ${new Date(item.finished_at).toLocaleDateString()}`
												: ""}
										</span>
									</span>
									<DetailStatus tone="success">served</DetailStatus>
								</button>
							))
						)}
					</div>

					{selected ? (
						<>
							<label className="block text-base text-muted-foreground">
								Key
								<input
									value={key}
									onChange={(e) => setKey(e.target.value)}
									placeholder="supplier-exposure"
									className="mt-1 w-full rounded-sm border bg-background px-2 py-1.5 font-mono text-base text-foreground"
								/>
								<span className="mt-0.5 block text-base text-muted-foreground/80">
									Lower-case, digits and dashes. Reusing an existing key adds
									the next version rather than overwriting it.
								</span>
							</label>
							<label className="block text-base text-muted-foreground">
								Description
								<input
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="What this plan does, in one line."
									className="mt-1 w-full rounded-sm border bg-background px-2 py-1.5 text-base text-foreground"
								/>
							</label>
						</>
					) : null}

					{error ? <p className="text-base text-destructive">{error}</p> : null}
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
									onSuccess: (workflow) => {
										reset();
										onOpenChange(false);
										onPromoted?.(workflow.key ?? "");
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
