import type { BindRefusal } from "@/types/skills";
import { cn } from "@invana/ui";

/**
 * Why a bind was refused — **one card, drawn wherever the click was**.
 *
 * A bind can be refused from either side: the Bindings tab, against an agent's
 * row, and the agent panel's picker, beneath the skill's chip
 * ([BN8](docs/for-developers/modules/skills/features/bindings.md)). Both draw
 * this, from the engine's payload, so the two surfaces cannot drift into saying
 * different things about one refusal ([BN11](docs/for-developers/modules/skills/features/bindings.md)).
 *
 * Nothing here composes a sentence of its own. The engine sends the facts
 * unflattened — the envelope half names a `step_key` and its `bound`, the lens
 * half names the `layer`, the plan's declared `layers`, one `participant` it
 * actually checked and the `rule` that denied it — and the card draws them.
 */
export function BindRefusalCard({
	refusal,
	/** Whichever side the click was *not* on — the agent, or the skill. */
	subject,
	className,
}: {
	refusal: BindRefusal;
	subject: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"rounded-sm border border-destructive/40 bg-destructive/5 p-2",
				className,
			)}
		>
			<p className="text-base font-medium">
				Refused by the {refusal.check} — {subject}
			</p>
			<p className="mt-0.5 text-base">{refusal.message}</p>
			{refusal.step_key ? (
				<p className="mt-1 font-mono text-base text-muted-foreground">
					{refusal.step_key}
					{refusal.bound ? ` · bound: ${refusal.bound}` : null}
				</p>
			) : null}
			{refusal.layer ? (
				<>
					{/*
					 * Every band the plan declares, the shut one struck. Naming only
					 * the closed band says what was shut and not what the skill
					 * needed, so a plan touching four bands and refused on one would
					 * read like a plan that only ever wanted that band (BN13). The
					 * strip is the reading the check already made — Studio strikes,
					 * and computes nothing.
					 *
					 * An envelope refusal carries no strip: it is about a `step_key`
					 * and read no bands, and a strip beside it would suggest grounds
					 * it did not check (BN7).
					 */}
					{refusal.layers?.length ? (
						<div className="mt-1 flex flex-wrap gap-1">
							{refusal.layers.map((layer) => (
								<span
									key={layer}
									className={cn(
										"rounded-sm border px-1.5 py-0.5 font-mono text-base",
										layer === refusal.layer
											? "border-destructive/40 text-destructive line-through"
											: "border-border text-muted-foreground",
									)}
								>
									{layer}
								</span>
							))}
						</div>
					) : null}
					<p className="mt-1 font-mono text-base text-muted-foreground">
						{refusal.layer}
						{refusal.rule ? ` · ${refusal.rule}` : null}
						{refusal.participant ? ` · ${refusal.participant}` : null}
					</p>
				</>
			) : null}
			<p className="mt-1 text-base text-muted-foreground">
				{refusal.not_checked?.length
					? `Checked ${refusal.checked?.join(" · ")}. Not checked: ${refusal.not_checked.join(" · ")} — so this bind was refused on what it read, and nothing else.`
					: `Both checks ran — ${refusal.checked?.join(" · ")} — so this is everything a bind can be refused on.`}
			</p>
		</div>
	);
}

/** The engine's `409`, or null when the error was something else. */
export function asBindRefusal(error: unknown): BindRefusal | null {
	const detail = (error as { detail?: unknown } | null)?.detail;
	if (!detail || typeof detail !== "object") return null;
	const body = detail as { error?: unknown } & BindRefusal;
	return body.error === "skill_binding_refused" ? body : null;
}
