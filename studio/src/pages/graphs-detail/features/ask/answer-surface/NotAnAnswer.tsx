/**
 * The two surfaces that must never look like an answer.
 *
 * `when-it-cannot-answer.md` names four outcomes and insists they never share a
 * shape (CA1). Two of them are ordinary — a **retry** and a **repair** — and both
 * are shown where they happened, on the step row, never as a message in the
 * thread (CA7). The other two need their own surface, and this is it:
 *
 * | Surface | Says | Looks like |
 * |---|---|---|
 * | {@link CannotAnswerCard} | the graph does not hold this | an answer's neighbour: quiet, no header, no citation strip |
 * | {@link DiagnosisCard} | something broke, and here is the evidence | a fault: a destructive rule, evidence, one next step |
 *
 * Neither carries an emission header or a citation strip (CA6). That is the
 * whole point: a reader scanning a thread must be able to tell at a glance that
 * this is *not* a result, without reading a word of it.
 */

import type { Diagnosis } from "@/types/run";
import { Button, cn } from "@invana/ui";
import { ChevronDown, CircleSlash, TriangleAlert } from "lucide-react";
import { useState } from "react";

/**
 * The graph does not hold what was asked.
 *
 * This is an **answer** (CA3) — it says what is missing and what would change
 * that — so it is drawn calmly rather than as an error. Putting it next to "the
 * graph timed out" would tell a reader those are the same kind of nothing.
 */
export function CannotAnswerCard({
	reason,
	stage,
	onLoadData,
	className,
}: {
	reason: string;
	/** Which step reached the conclusion — usually `understand`, before any query. */
	stage?: string;
	/** The load path, offered because it is the thing that would actually help. */
	onLoadData?: () => void;
	className?: string;
}) {
	return (
		<div
			data-testid="cannot-answer"
			className={cn(
				"flex gap-2.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5",
				className,
			)}
		>
			<CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
			<div className="flex min-w-0 flex-col gap-1.5">
				<p className="text-sm text-foreground">{reason}</p>
				<p className="text-xs text-muted-foreground">
					This is what the graph does not hold — not a failure.
					{stage ? ` Settled at ${stage}, before any query ran.` : ""}
				</p>
				{onLoadData ? (
					<div>
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-3 font-normal"
							onClick={onLoadData}
						>
							Load a dataset
						</Button>
					</div>
				) : null}
			</div>
		</div>
	);
}

/**
 * Something broke, and the evidence it was built from.
 *
 * Built from the failure itself, never invented (CA5): the cause, the step, the
 * query. The next steps are the only actions on it (CA6) — there is no "try
 * again" that quietly re-asks a different question.
 */
export function DiagnosisCard({
	diagnosis,
	onRetry,
	onFocusComposer,
	onRoute,
	className,
}: {
	diagnosis: Diagnosis;
	onRetry?: () => void;
	onFocusComposer?: () => void;
	onRoute?: (route: string) => void;
	className?: string;
}) {
	const [showEvidence, setShowEvidence] = useState(false);
	const evidence = Object.entries(diagnosis.evidence ?? {}).filter(
		([, value]) => value !== null && value !== undefined && value !== "",
	);

	return (
		<div
			data-testid="diagnosis"
			className={cn(
				"flex gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5",
				className,
			)}
		>
			<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<p className="text-sm text-foreground">{diagnosis.summary}</p>

				{evidence.length > 0 ? (
					<div>
						<button
							type="button"
							onClick={() => setShowEvidence((v) => !v)}
							className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
						>
							<ChevronDown
								className={cn(
									"h-3 w-3 transition-transform",
									!showEvidence && "-rotate-90",
								)}
							/>
							Evidence
						</button>
						{showEvidence ? (
							<dl className="mt-1 space-y-0.5">
								{evidence.map(([key, value]) => (
									<div key={key} className="flex gap-2 text-xs">
										<dt className="w-28 shrink-0 text-muted-foreground">
											{key}
										</dt>
										<dd className="min-w-0 flex-1 break-all font-mono text-foreground">
											{typeof value === "object"
												? JSON.stringify(value)
												: String(value)}
										</dd>
									</div>
								))}
							</dl>
						) : null}
					</div>
				) : null}

				{diagnosis.suggestions.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{diagnosis.suggestions.map((s) => (
							<Button
								key={s.label}
								variant="outline"
								size="sm"
								className="h-7 px-3 font-normal"
								onClick={() => {
									if (s.action?.retry) onRetry?.();
									else if (s.action?.focus_composer) onFocusComposer?.();
									else if (s.route) onRoute?.(s.route);
								}}
							>
								{s.label}
							</Button>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}
