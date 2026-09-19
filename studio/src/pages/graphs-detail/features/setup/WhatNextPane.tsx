import { WHAT_NEXT } from "@/pages/graphs-detail/features/setup/setupSteps";
import { useSettingsPanel } from "@/pages/graphs-detail/shell/useSettingsPanel";
import { type Graph, isSetupComplete } from "@/types/graphs";
import { Eyebrow } from "@/ui/Eyebrow";
import {
	Button,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
} from "@invana/ui";
import { ArrowRight } from "lucide-react";

/**
 * The offers, in the pane the lessons use (setup.md SU4).
 *
 * Setup ends at the first answer — but the answers worth having come from the
 * surfaces below it: an agent that knows the domain, a workflow that pins down
 * what a good answer does, a second model stitched in. So the wizard says so,
 * in the last row of its rail, rather than leaving "is that it?" unanswered.
 *
 * **No status, ever.** These are not steps and none of them is owed: a product
 * that opens with nine unfinished obligations reads as homework. That is why
 * there is no dot in the rail beside this row, and none on any row here.
 */
export function WhatNextPane({ graph }: { graph: Graph }) {
	const { setSection } = useSettingsPanel();
	const ready = isSetupComplete(graph);

	return (
		<div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-5">
			<header className="flex flex-col gap-1 pt-4">
				<Eyebrow>What next</Eyebrow>
				<h2 className="font-semibold text-lg">
					Setup ends at the first answer. This is what makes it a good one.
				</h2>
				<p className="text-muted-foreground">
					{ready
						? "Nothing here is owed, and nothing here has a status. Take them in any order, or none."
						: "None of these is a setup step, and none of them is waiting on you. They are here so the four steps have a point."}
				</p>
			</header>

			<ItemGroup>
				{WHAT_NEXT.map((offer) => (
					<Item key={offer.label} variant="muted">
						<ItemContent>
							<ItemTitle>{offer.label}</ItemTitle>
							<ItemDescription>{offer.description}</ItemDescription>
						</ItemContent>
						<ItemActions>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setSection(offer.settingsSection)}
							>
								Open
								<ArrowRight className="size-3.5" />
							</Button>
						</ItemActions>
					</Item>
				))}
			</ItemGroup>
		</div>
	);
}
