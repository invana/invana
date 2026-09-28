import { LayeredCanvasStatus } from "@/canvases/layered/LayeredCanvasChrome";
import { ExplorerHeaderToolbar } from "@/pages/graphs-detail/features/explorer";
import type { useDataBoards } from "@/pages/graphs-detail/shell/useDataBoards";
import type { useLayeredCanvas } from "@/pages/graphs-detail/shell/useLayeredCanvas";
import type { useRightSection } from "@/pages/graphs-detail/shell/useRightSection";
import {
	CanvasMessageBar,
	GraphStatusBar as CanvasStatusBar,
} from "@invana/canvas-ui";
import { Button, cn } from "@invana/ui";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/** What the header controls and the `footer` read from the page that hosts them. */
export interface GraphDetailChromeDeps {
	username: string | undefined;
	graphSlug: string | undefined;
	right: ReturnType<typeof useRightSection>;
	dataBoards: ReturnType<typeof useDataBoards>;
	activeSessionId: string | null;
	/** The layered canvas `mainSection` draws, when a panel drove one. */
	workCanvas: ReactNode;
	workTarget: ReturnType<typeof useLayeredCanvas>["workTarget"];
}

/**
 * The Graph page's header controls and `footer` — the assistant's trigger,
 * the canvas toolbar over a data canvas, the status metrics for whichever
 * canvas is in front, and the canvas message bar. Returned as the
 * `GraphDetail` props they fill.
 */
export function graphDetailChrome(deps: GraphDetailChromeDeps) {
	const {
		username,
		graphSlug,
		right,
		dataBoards,
		activeSessionId,
		workCanvas,
		workTarget,
	} = deps;
	const { canvas, magnet, toggleMagnet, backend, setBackend } = dataBoards;

	return {
		// One assistant, reachable from every surface (AD1). The trigger sits
		// in the header's panel controls, after fullscreen — a persistent
		// control, so it keeps one name wherever you are.
		headerPanelControls: (
			<Button
				variant="ghost"
				size="icon"
				className={cn("h-7 w-7", right.is("assistant") && "text-primary")}
				onClick={() => right.toggle("assistant")}
				title={right.is("assistant") ? "Close the assistant" : "Ask about this"}
			>
				<Sparkles className="h-4 w-4" />
			</Button>
		),
		headerCenter:
			canvas && activeSessionId ? (
				// The canvas toolbar reads the live camera; it only initialises
				// correctly mounted in the app header (in the main-section tab bar
				// the camera reads null and `HeaderToolbarItems` throws). It sits
				// directly above the canvas tabs. Dead-centre it against the full
				// header width (the header nav is `relative`; see useAppHeader).
				<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
					<ExplorerHeaderToolbar
						magnet={magnet}
						onToggleMagnet={toggleMagnet}
						backend={backend}
						onBackendChange={setBackend}
					/>
				</div>
			) : undefined,
		statusMetrics:
			// Live engine telemetry — node/edge totals, zoom, pan, pointer world
			// position, hovered node/edge, selection counts — self-wired off the
			// lifted CanvasContext (same status bar as the canvas-react story).
			// A work canvas has no engine, so it states what it *is* instead:
			// `LIBRARY · 8 steps · 3 agents`.
			workCanvas && workTarget ? (
				<LayeredCanvasStatus
					username={username as string}
					graphSlug={graphSlug as string}
					target={workTarget}
				/>
			) : canvas && activeSessionId ? (
				<CanvasStatusBar />
			) : null,
		// The shared message bar — shows whatever was last pushed via
		// Board.showMessage (e.g. a layout's "Running… / ready"); empty when idle.
		footerRightExtras: canvas && activeSessionId ? <CanvasMessageBar /> : null,
	};
}
