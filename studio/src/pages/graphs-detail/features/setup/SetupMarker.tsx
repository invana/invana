import type { setupSectionStatus } from "@/types/graphs";
import { StatusDot } from "@invana/ui";
import { Check } from "lucide-react";

type Status = ReturnType<typeof setupSectionStatus>;

/**
 * What sits in the gutter beside a setup step, in every rendering of it.
 *
 * A **done** step is a check, not a dot. The other five states are states — a
 * thing that could still change — and a dot is the right shape for those. Done
 * is a fact that exists (SU1), and a step already carries "the fact exists" in
 * its own right; a green dot beside it says only "green", which at a glance is
 * indistinguishable from `running` in every other list in the product.
 *
 * One component because the stepper and the Info band are one sequence in two
 * renderings (G27): a marker that drifts between them makes the same step read
 * as two different things in two places.
 */
export function SetupMarker({
	status,
	isNext,
}: {
	status: Status;
	isNext: boolean;
}) {
	if (status === "done") {
		return (
			<span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-success text-background">
				<Check className="size-2.5" strokeWidth={3} />
			</span>
		);
	}
	return (
		<span className="flex size-3.5 shrink-0 items-center justify-center">
			<StatusDot tone={toneFor(status, isNext)} size="md" />
		</span>
	);
}

/** The five states that are not `done`. Kept here so the stepper, the band and
 *  the board cannot disagree about what colour a blocked step is. */
export function toneFor(
	status: Status,
	isNext: boolean,
): "success" | "error" | "muted" | "info" | "queued" {
	if (status === "done") return "success";
	if (status === "broken") return "error";
	if (status === "skipped") return "muted";
	if (status === "blocked") return "queued";
	return isNext ? "info" : "queued";
}
