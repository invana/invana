import { ArrowRight, Plug } from "lucide-react";
import { useSettingsPanel } from "./useSettingsPanel";

interface Props {
	/** Surface name shown in the heading — e.g. "Explorer", "Modeller". */
	pageLabel: string;
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
export function SetupRequiredBanner({ pageLabel }: Props) {
	const settingsPanel = useSettingsPanel();
	const lowerLabel = pageLabel.toLowerCase();

	return (
		<div className="h-full w-full flex items-center justify-center p-4">
			<div className="w-full max-w-md border border-border rounded-lg p-6 text-center space-y-4">
				<div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center">
					<Plug className="w-5 h-5 text-muted-foreground" />
				</div>
				<div>
					<h2 className="font-semibold">{pageLabel} isn't ready yet</h2>
					<p className="text-muted-foreground mt-1">
						Attach a graph database connection to this graph before you can use
						the {lowerLabel}.
					</p>
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
