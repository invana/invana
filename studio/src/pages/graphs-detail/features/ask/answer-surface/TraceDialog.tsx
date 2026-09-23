/**
 * The reasoning trace — the whole run, after the fact.
 *
 * This is **part of the answer, not an admin view** (reasoning-trace.md RT1): if
 * you can see the answer you can see how it was reached. It opens from an
 * emission's own citation, because "where did this come from" is a question about
 * a specific number, not about the session.
 *
 * Steps stack on the left, the selected step's detail sits beside them, and two
 * things are deliberately never merged:
 *
 * - **Offered and applied stay two lists** (RT3). `offered` is a fact about the
 *   prompt; `applied` is the model's own report. Showing one number would be a
 *   claim we cannot make. Rules carry the same pair, drawn as the statements
 *   themselves rather than as counts — a rule is only readable as its wording
 *   (RU12). A statement links to its rule's board, and because this is a modal
 *   the act is **close the trace, then open the board** — a board opened behind
 *   a dialog is a page nobody can see, and dropping the link would make the
 *   answer surface the one place a rule cannot be reached (RU13). The trace is
 *   one click away again on the same citation chip.
 * - **The generated query is verbatim and copyable** (RT2), so the check on the
 *   answer is running the query yourself, not trusting the prose around it.
 */

import { formatDuration } from "@/lib/time";
import { useOpenBoard } from "@/pages/graphs-detail/features/boards";
import { StepRules } from "@/pages/graphs-detail/features/work/StepRules";
import { stepTone } from "@/pages/graphs-detail/shared/statusTone";
import { type TraceStepRead, traceApi } from "@/services/api/runs";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Spinner,
	StatusDot,
	cn,
} from "@invana/ui";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
	open: boolean;
	onClose: () => void;
	username: string;
	graphSlug: string;
	runId: string;
}

const OUTCOME_COPY: Record<string, string> = {
	answered: "answered",
	cannot_answer: "the graph does not hold this",
	failed: "failed",
	cancelled: "cancelled",
};

export function TraceDialog({
	open,
	onClose,
	username,
	graphSlug,
	runId,
}: Props) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	// Null outside the page host — a statement then reads as text rather than as
	// a link that fails (RU13).
	const openBoard = useOpenBoard();
	const openRule = openBoard
		? (ruleId: string) => {
				onClose();
				openBoard("rule", ruleId);
			}
		: undefined;
	const trace = useQuery({
		queryKey: ["trace", username, graphSlug, runId] as const,
		queryFn: () => traceApi.get(username, graphSlug, runId),
		enabled: open,
	});

	const steps = trace.data?.steps ?? [];
	const selected = steps.find((s) => s.id === selectedId) ?? steps[0] ?? null;

	return (
		<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="max-w-4xl">
				<DialogHeader>
					<DialogTitle>How this was reached</DialogTitle>
					<DialogDescription>
						{trace.data ? (
							<>
								{trace.data.workflow_key} ·{" "}
								{OUTCOME_COPY[trace.data.outcome ?? ""] ?? trace.data.status}
								{trace.data.duration_ms !== null
									? ` · ${formatDuration(trace.data.duration_ms)}`
									: ""}
								{trace.data.tokens_in || trace.data.tokens_out
									? ` · ${trace.data.tokens_in} in · ${trace.data.tokens_out} out`
									: ""}
								{trace.data.plan_origin
									? ` · plan ${trace.data.plan_origin}`
									: ""}
							</>
						) : (
							"Reading the run…"
						)}
					</DialogDescription>
				</DialogHeader>

				{trace.isLoading ? (
					<Spinner />
				) : steps.length === 0 ? (
					<p className="text-base text-muted-foreground">
						This run's steps have been purged. The shape of what happened stays
						on the record; the payloads do not.
					</p>
				) : (
					<div className="grid max-h-[60vh] grid-cols-[220px_1fr] gap-4 overflow-hidden">
						<div className="min-h-0 overflow-y-auto border-r pr-2">
							{steps.map((step) => (
								<button
									key={step.id}
									type="button"
									onClick={() => setSelectedId(step.id)}
									className={cn(
										"flex w-full flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left text-base",
										selected?.id === step.id
											? "bg-accent"
											: "hover:bg-accent/50",
									)}
								>
									<span className="flex items-center gap-1.5">
										<StatusDot tone={stepTone(step.status)} />
										<span className="truncate">{step.label}</span>
										{step.attempt > 1 ? (
											<span className="text-sm text-warning">
												attempt {step.attempt}
											</span>
										) : null}
									</span>
									<span className="truncate text-sm text-muted-foreground">
										{step.detail || step.task_key}
									</span>
								</button>
							))}
						</div>

						<div className="min-h-0 overflow-y-auto pr-1">
							{selected ? (
								<StepDetail
									step={selected}
									username={username}
									graphSlug={graphSlug}
									onOpenRule={openRule}
								/>
							) : null}
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

function StepDetail({
	step,
	username,
	graphSlug,
	onOpenRule,
}: {
	step: TraceStepRead;
	username: string;
	graphSlug: string;
	/** Close the trace and open the rule's board (RU13). */
	onOpenRule?: (ruleId: string) => void;
}) {
	const query =
		(step.output?.query as string | undefined) ??
		(step.input?.query as string | undefined);

	return (
		<div className="flex flex-col gap-3 text-base">
			<div className="flex flex-wrap items-baseline gap-2">
				<span className="font-medium">{step.label}</span>
				<span className="font-mono text-sm text-muted-foreground">
					{step.task_key}
				</span>
				<span className="text-sm text-muted-foreground">
					{step.duration_ms !== null ? formatDuration(step.duration_ms) : "—"}
					{step.tokens_in != null
						? ` · ${step.tokens_in} in · ${step.tokens_out ?? 0} out`
						: ""}
				</span>
			</div>

			{query ? <QueryBlock query={query} /> : null}

			{/* Two lists, two certainties (RT3). Never one number. */}
			<Section title="Skills">
				{step.skills_offered.length === 0 &&
				step.skills_applied.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						None offered on this step.
					</p>
				) : (
					<div className="space-y-1 text-sm">
						<p>
							<span className="text-muted-foreground">offered</span>{" "}
							{step.skills_offered.length}
							<span className="ml-1 text-muted-foreground">
								— a fact about the prompt
							</span>
						</p>
						<p>
							<span className="text-muted-foreground">reported applied</span>{" "}
							{step.skills_applied.length}
							<span className="ml-1 text-muted-foreground">
								— the model's own claim
							</span>
						</p>
					</div>
				)}
			</Section>

			{/* The other pair, and the wording rather than a count (RU12). */}
			<Section title="Rules">
				{step.rules_offered.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						None offered on this step.
					</p>
				) : (
					<StepRules
						offered={step.rules_offered}
						cited={step.rules_cited}
						onOpenRule={onOpenRule}
					/>
				)}
			</Section>

			{step.input ? (
				<Section title="Input">
					<Facts data={step.input} />
				</Section>
			) : null}
			{step.output ? (
				<Section title="Output">
					<Facts data={step.output} />
				</Section>
			) : null}
			{step.error ? (
				<Section title="Error">
					<Facts data={step.error} />
				</Section>
			) : null}

			{/* A delegated run nests under the step that spawned it (RT4), collapsed
			    by default: the parent's trace is the subject, and the child is a
			    detail of one of its steps rather than a second story beside it. */}
			{step.child_run_id ? (
				<ChildTrace
					username={username}
					graphSlug={graphSlug}
					runId={step.child_run_id}
				/>
			) : null}
		</div>
	);
}

/**
 * The child a `delegate` step waited on, in place.
 *
 * The child is a full run — its own plan, its own stream, its own trace
 * (docs/for-developers/modules/agents/features/delegation.md) — so this is the
 * same step list, one level in. It loads only when opened: a parent with five
 * children should not fetch five traces to show five collapsed rows.
 */
function ChildTrace({
	username,
	graphSlug,
	runId,
}: {
	username: string;
	graphSlug: string;
	runId: string;
}) {
	const [open, setOpen] = useState(false);
	const child = useQuery({
		queryKey: ["trace", username, graphSlug, runId] as const,
		queryFn: () => traceApi.get(username, graphSlug, runId),
		enabled: open,
	});

	return (
		<div className="rounded-sm border">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-sm"
			>
				<ChevronRight
					className={cn("h-3 w-3 transition-transform", open && "rotate-90")}
				/>
				<span className="font-medium">Delegated run</span>
				<span className="text-muted-foreground">
					{child.data
						? `${child.data.steps.length} steps · ${
								OUTCOME_COPY[child.data.outcome ?? ""] ?? child.data.status
							}`
						: "the child this step waited on"}
				</span>
			</button>
			{open ? (
				<div className="border-t px-2 py-1.5">
					{child.isLoading ? (
						<Spinner />
					) : !child.data ? (
						<p className="text-sm text-muted-foreground">
							The child's trace has been pruned.
						</p>
					) : (
						<ul className="space-y-0.5">
							{child.data.steps.map((s) => (
								<li key={s.id} className="flex items-center gap-1.5 text-sm">
									<StatusDot tone={stepTone(s.status)} />
									<span className="truncate">{s.label}</span>
									<span className="truncate text-muted-foreground">
										{s.detail}
									</span>
								</li>
							))}
						</ul>
					)}
				</div>
			) : null}
		</div>
	);
}

/** The query, verbatim, copyable — the check on the answer is running it (RT2). */
function QueryBlock({ query }: { query: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="rounded-sm border">
			<div className="flex items-center justify-between border-b px-2 py-1">
				<span className="text-sm text-muted-foreground">
					the query, as executed
				</span>
				<Button
					variant="ghost"
					size="sm"
					className="h-6 px-1.5"
					onClick={async () => {
						await navigator.clipboard.writeText(query);
						setCopied(true);
						toast.success("Query copied — run it yourself in the editor.");
						setTimeout(() => setCopied(false), 1500);
					}}
				>
					{copied ? (
						<Check className="h-3.5 w-3.5" />
					) : (
						<Copy className="h-3.5 w-3.5" />
					)}
				</Button>
			</div>
			<pre className="overflow-x-auto px-2 py-1.5 font-mono text-sm">
				{query}
			</pre>
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<p className="mb-1 text-sm uppercase tracking-wide text-muted-foreground">
				{title}
			</p>
			{children}
		</div>
	);
}

function Facts({ data }: { data: Record<string, unknown> }) {
	const rows = Object.entries(data).filter(([, v]) => v !== null && v !== "");
	if (rows.length === 0) {
		return <p className="text-sm text-muted-foreground">Nothing recorded.</p>;
	}
	return (
		<dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-sm">
			{rows.map(([key, value]) => (
				<div key={key} className="contents">
					<dt className="text-muted-foreground">{key}</dt>
					<dd className="min-w-0 break-all font-mono">
						{typeof value === "object" ? JSON.stringify(value) : String(value)}
					</dd>
				</div>
			))}
		</dl>
	);
}
