import { ButtonWithTooltip, cn } from "@invana/ui";
import { hasOutstandingSetup, useGraphQuery } from "@invana-studio/core";
import { GraduationCap } from "lucide-react";
import { useOpenGraph } from "../../products";
import { useOnboarding } from "../../setup/useOnboarding";

/**
 * The door the onboarding wizard never closes
 * (docs/for-developers/modules/platform/features/setup.md).
 *
 * `header.right`, between `GitHubStars` and `ThemeMenu`, on graph-scoped routes
 * only — a Graph has onboarding, the Graphs list does not. It is **lit** while
 * a required step is outstanding and muted once the Graph is ready, but it
 * never disappears: undoing a skip, reading why a step went broken and going
 * over a concept again all live in the wizard, and a surface you can only reach
 * while you do not yet understand the product is the wrong surface to hide.
 *
 * *Graduation* is the icon's metaphor only. The state a Graph reaches is
 * **ready** (terminology.md), and no surface here says otherwise.
 */
function OnboardingCap({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const { data: graph } = useGraphQuery(username, graphSlug);
	const { open } = useOnboarding();
	const outstanding = hasOutstandingSetup(graph);

	return (
		<ButtonWithTooltip
			tooltip={
				outstanding ? "Setup — what is left" : "Setup — go over it again"
			}
			variant="ghost"
			size="icon"
			aria-label="Open onboarding"
			onClick={open}
			className={cn("h-7 w-7", outstanding && "text-primary")}
		>
			<GraduationCap className="size-4" />
		</ButtonWithTooltip>
	);
}

/** The cap for the open Graph — the header's default `status`. Off a Graph
 *  there is no onboarding, so there is no cap. */
export function GraphOnboardingCap() {
	const graph = useOpenGraph();
	return graph ? <OnboardingCap {...graph} /> : null;
}
