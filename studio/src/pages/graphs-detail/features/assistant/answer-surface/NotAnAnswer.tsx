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
 * | {@link RunCannotAnswer} | the graph does not hold this | an answer's neighbour: quiet, dashed, no citation strip |
 * | {@link RunDiagnosis} | something broke, and here is the evidence | a fault: a destructive rule, evidence, one next step |
 *
 * Both cards are the kit's (`@invana/ui` · `CannotAnswerCard`, `DiagnosisCard`),
 * which is what guarantees the rule the kit states as DS8: a refusal and a
 * failure are separate components, so neither is one prop away from an answer.
 * What lives here is the mapping from Invana's `Diagnosis` onto their slots.
 *
 * Neither carries an emission header or a citation strip (CA6). That is the
 * whole point: a reader scanning a thread must be able to tell at a glance that
 * this is *not* a result, without reading a word of it.
 */

import type { Diagnosis } from "@/types/run";
import { Button, CannotAnswerCard, DiagnosisCard } from "@invana/ui";

/**
 * The graph does not hold what was asked.
 *
 * This is an **answer** (CA3) — it says what is missing and what would change
 * that — so it is drawn calmly rather than as an error. Putting it next to "the
 * graph timed out" would tell a reader those are the same kind of nothing.
 */
export function RunCannotAnswer({
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
		<CannotAnswerCard
			data-testid="cannot-answer"
			className={className}
			remedy={
				<>
					This is what the graph does not hold — not a failure.
					{stage ? ` Settled at ${stage}, before any query ran.` : ""}
					{onLoadData ? (
						<Button
							variant="outline"
							size="sm"
							className="ml-2 h-7 px-3 font-normal"
							onClick={onLoadData}
						>
							Load a dataset
						</Button>
					) : null}
				</>
			}
		>
			{reason}
		</CannotAnswerCard>
	);
}

/**
 * Something broke, and the evidence it was built from.
 *
 * Built from the failure itself, never invented (CA5): the cause, the step, the
 * query. The next steps are the only actions on it (CA6) — there is no "try
 * again" that quietly re-asks a different question.
 */
export function RunDiagnosis({
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
	const evidence = Object.entries(diagnosis.evidence ?? {}).filter(
		([, value]) => value !== null && value !== undefined && value !== "",
	);

	return (
		<DiagnosisCard
			data-testid="diagnosis"
			className={className}
			code={diagnosis.cause}
			attempted={
				evidence.length > 0 ? (
					<dl className="space-y-0.5">
						{evidence.map(([key, value]) => (
							<div key={key} className="flex gap-2">
								<dt className="w-28 shrink-0 text-muted-foreground">{key}</dt>
								<dd className="min-w-0 flex-1 break-all">
									{typeof value === "object"
										? JSON.stringify(value)
										: String(value)}
								</dd>
							</div>
						))}
					</dl>
				) : undefined
			}
			actions={
				diagnosis.suggestions.length > 0
					? diagnosis.suggestions.map((s) => (
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
						))
					: undefined
			}
		>
			{diagnosis.summary}
		</DiagnosisCard>
	);
}
