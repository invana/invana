/**
 * W4 · the guardrails, locked above the worlds list.
 *
 * *As someone picking a world, I want the ceiling in view while I pick, so that
 * I read each world as **narrower than this** rather than as the whole bound.*
 *
 * **Not a component in the kit** ([panels.md §3](../../../../../docs/for-developers/building-studio/govern-and-agents-panels.md)):
 * it is `PanelBox` + `LayerChip` + a link, one composition used in one place.
 *
 * **It states, and it does not offer.** Nothing here is pickable — a guardrail
 * is in force whatever world is chosen, and a row that highlighted on click
 * would say it is one of the things you choose between. The one control is the
 * way to the drawer that holds the rules, because a bound nobody may read is a
 * bound nobody can work within
 * ([GR5](../../../../../docs/for-developers/modules/govern/features/guardrails.md)).
 */

import { ruleLayer } from "@/pages/graphs-detail/features/govern/narrowing";
import type { Lens } from "@/types/govern";
import { LAYER_PALETTE } from "@/ui/layerPalette";
import { Button, type Layer, LayerChip, PanelBox } from "@invana/ui";

export interface GuardrailsStripProps {
	guardrails: Lens[];
	onRead: () => void;
}

export function GuardrailsStrip({ guardrails, onRead }: GuardrailsStripProps) {
	const rules = guardrails.flatMap((g) => g.rules ?? []);

	// One chip per layer a guardrail says anything about, with how many rules it
	// says. A layer no guardrail names is not drawn: the strip is what is *in
	// force*, and six chips of which four mean nothing would read as a bound
	// that is stricter than it is.
	const counts = new Map<Layer, number>();
	for (const rule of rules) {
		const layer = ruleLayer(rule) as Layer;
		counts.set(layer, (counts.get(layer) ?? 0) + 1);
	}

	return (
		<PanelBox
			title="In force on every run"
			aside={
				guardrails.length === 1
					? guardrails[0].display_name
					: `${guardrails.length} guardrails`
			}
		>
			<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
				{counts.size ? (
					[...counts].map(([layer, count]) => (
						<LayerChip
							key={layer}
							layer={layer}
							count={count}
							palette={LAYER_PALETTE}
						/>
					))
				) : (
					<span className="text-sm text-muted-foreground">
						no rules — the guardrail narrows nothing
					</span>
				)}
				<Button
					variant="link"
					size="sm"
					className="ml-auto h-auto p-0 text-sm"
					onClick={onRead}
				>
					Read them
				</Button>
			</div>
		</PanelBox>
	);
}
