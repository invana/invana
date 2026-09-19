import { useGraphQuery } from "@/hooks/queries/useGraphs";
import { useOnboarding } from "@/pages/graphs-detail/features/setup/useOnboarding";
import { hasOutstandingSetup } from "@/types/graphs";
import { ButtonWithTooltip, cn } from "@invana/ui";
import { GraduationCap } from "lucide-react";

/**
 * The door the onboarding wizard never closes
 * (docs/for-developers/modules/platform/features/setup.md SU19).
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
export function OnboardingCap({
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
