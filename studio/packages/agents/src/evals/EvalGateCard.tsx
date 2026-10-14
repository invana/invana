/**
 * The eval gate's refusal, drawn where the act was: a publish, a restore or a
 * pin move that the engine would not let through.
 *
 * | Refusal | What the reader does |
 * |---|---|
 * | `eval_required` | run the evals on this exact candidate — the card offers it |
 * | `eval_running` | wait for the run to settle |
 * | `eval_failed` | a hard check failed — change the text, it cannot be published past |
 * | `eval_warned` | it got slower or used more tokens — say why, and publish again |
 *
 * Any other refusal is the engine's own sentence, shown as it came.
 */

import { Button, RefusalCard } from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { Play } from "lucide-react";
import { asEvalRefusal } from "./queries";

const LABEL: Record<string, string> = {
	eval_required: "refused · the eval gate · no eval run on this candidate",
	eval_running: "refused · the eval gate · the eval run is still going",
	eval_failed: "refused · the eval gate · a hard check failed",
	eval_warned: "refused · the eval gate · it warned, and no reason was given",
};

const REMEDY: Record<string, string> = {
	eval_required: "Run the evals on it, then publish again.",
	eval_running: "Wait for the run to settle, then publish again.",
	eval_failed:
		"Change the text so the check holds; a failed check cannot be published past.",
	eval_warned: "Say why you are publishing past it, and publish again.",
};

export function EvalGateCard({
	error,
	onRunEvals,
	running,
}: {
	error: unknown;
	/** Offered on `eval_required`: open the run the gate asks for. */
	onRunEvals?: () => void;
	running?: boolean;
}) {
	if (!error) return null;
	const refusal = asEvalRefusal(error);
	if (!refusal) return <FormError error={error as Error} />;
	return (
		<RefusalCard
			label={LABEL[refusal.error]}
			remedy={
				refusal.error === "eval_required" && onRunEvals ? (
					<Button
						size="xs"
						variant="outline"
						disabled={running}
						onClick={onRunEvals}
					>
						<Play /> {running ? "Opening…" : "Run the evals"}
					</Button>
				) : (
					REMEDY[refusal.error]
				)
			}
		>
			{refusal.message}
			{(refusal.reasons ?? []).length > 1 ? (
				<ul>
					{refusal.reasons?.map((r) => (
						<li key={r}>{r}</li>
					))}
				</ul>
			) : null}
		</RefusalCard>
	);
}
