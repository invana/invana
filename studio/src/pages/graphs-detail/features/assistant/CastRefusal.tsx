/**
 * An ask a bound refused **before it ran** — drawn as *This ask was not run*,
 * naming the world it was asked in, the role, the model the world cast, and
 * whose guardrail said no (AG6 · AG35).
 *
 * The engine answers the send with a `422` whose body carries these facts
 * beside the sentence (`error: "cast_refused"`); nothing is written, so there
 * is no run to open and no step to retry.
 */

import { RefusalCard } from "@invana/ui";
import type { CastRefusal } from "@/pages/graphs-detail/features/assistant/types";

/** The refusal in a failed send's body, or null for any other failure. */
export function asCastRefusal(error: unknown): CastRefusal | null {
	const detail = (error as { detail?: unknown } | null)?.detail;
	if (!detail || typeof detail !== "object") return null;
	const body = detail as { error?: unknown } & CastRefusal;
	return body.error === "cast_refused" ? body : null;
}

/** `the agent's own guardrail 'Nothing leaves'` → `the agent's own guardrail`. */
function boundSide(deniedIn: string | null): string {
	if (!deniedIn) return "this world";
	const quote = deniedIn.indexOf(" '");
	return quote > 0 ? deniedIn.slice(0, quote) : deniedIn;
}

export function CastRefusalCard({ refusal }: { refusal: CastRefusal }) {
	return (
		<RefusalCard
			label={`refused · ${boundSide(refusal.denied_in)}`}
			remedy="Ask in a world whose models this guardrail allows, or ask an agent without it."
		>
			<b>This ask was not run.</b> In <b>{refusal.world ?? "this world"}</b>,{" "}
			<code>{refusal.role}</code> is cast to <code>{refusal.address}</code>, and{" "}
			{refusal.denied_in ?? "a rule of this world"}
			{refusal.rule ? (
				<>
					{" "}
					— <code>{refusal.rule}</code> —
				</>
			) : null}{" "}
			does not allow it.
		</RefusalCard>
	);
}
