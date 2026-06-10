import { ArrowRight, ListChecks, Plug } from "lucide-react";
import { useSettingsPanel } from "./useSettingsPanel";

interface Props {
	/** Surface name shown in the heading — e.g. "Explorer", "Modeller". */
	pageLabel: string;
	/**
	 * Why the surface is gated:
	 * - `connection` (default): no `GraphConnection` attached yet.
	 * - `setup`: connection exists but the required setup-wizard sections
	 *   (graph_info + intent) aren't complete — mirrors the engine's
	 *   `graph_setup_incomplete` 409 guard.
	 */
	reason?: "connection" | "setup";
}

/**
 * Reusable "graph connection isn't set up" empty-state. Rendered wherever a
 * surface can't function without an attached `GraphConnection` — Explorer +
 * Modeller's leftSection today, future surfaces (agent runner, dataset
 * viewer, ...) the same way.
 *
 * Self-contained: clicking "Open setup" calls `useSettingsPanel().setSection("info")`
 * to dock the Info panel (which hosts the Setup wizard with the "Set up →"
 * link into the Connection form). Callers just drop this component in the
 * slot they want to gate.
 *
 * Designed for narrow panes — fits a ~260px wide leftSection without
 * scrolling. The card chrome adapts to whatever width its container offers.
 */
export function SetupRequiredBanner({
	pageLabel,
	reason = "connection",
}: Props) {
	const settingsPanel = useSettingsPanel();
	const lowerLabel = pageLabel.toLowerCase();
	const Icon = reason === "setup" ? ListChecks : Plug;
	const body =
		reason === "setup"
			? `Finish the setup wizard (Graph Info + Intent) before you can use the ${lowerLabel}.`
			: `Attach a graph database connection to this graph before you can use the ${lowerLabel}.`;

	return (
		<div className="h-full w-full flex items-center justify-center p-4">
			<div className="w-full max-w-md border border-border rounded-lg p-6 text-center space-y-4">
				<div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center">
					<Icon className="w-5 h-5 text-muted-foreground" />
				</div>
				<div>
					<h2 className="font-semibold">{pageLabel} isn't ready yet</h2>
					<p className="text-muted-foreground mt-1">{body}</p>
				</div>
				<button
					type="button"
					onClick={() => settingsPanel.setSection("info")}
					className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
				>
					Open setup
					<ArrowRight className="w-4 h-4" />
				</button>
			</div>
		</div>
	);
}
