import {
	CanvasMessageBar,
	GraphStatusBar as CanvasStatusBar,
	MessageStatus,
	RendererStatus,
	ViewStatus,
} from "@invana/canvas-ui";
import { Button, cn } from "@invana/ui";
import {
	type ConsoleTab,
	countsOf,
	queryStepsOf,
	type useConsoleParam,
} from "@invana-studio/assistant";
import type { GraphConnectionRead, Session } from "@invana-studio/core";
import {
	ConnectionLine,
	ConsoleCounts,
	ExplorerHeaderToolbar,
} from "@invana-studio/explorer";
import type { useRightSection } from "@invana-studio/shell";
import { Star } from "lucide-react";
import type { ReactNode } from "react";
import { LayeredCanvasStatus } from "@/canvases/layered/LayeredCanvasChrome";
import type { useDataBoards } from "@/host/useDataBoards";
import type { useLayeredCanvas } from "@/host/useLayeredCanvas";

/** What the header controls and the `footer` read from the page that hosts them. */
export interface HostChromeDeps {
	username: string | undefined;
	graphSlug: string | undefined;
	right: ReturnType<typeof useRightSection>;
	dataBoards: ReturnType<typeof useDataBoards>;
	activeSessionId: string | null;
	/** The layered canvas `mainSection` draws, when a panel drove one. */
	workCanvas: ReactNode;
	workTarget: ReturnType<typeof useLayeredCanvas>["workTarget"];
	/** The Explorer draws its own header switch and `footer`. */
	explorer: boolean;
	/** The user menu's *Assistant* — off, the header has no Assistant button. */
	assistantShown: boolean;
	connection: GraphConnectionRead | null | undefined;
	/** A data canvas is the page in front — the footer counts what it drew. */
	dataBoardInFront: boolean;
	/** The open thread — its replies are the queries the footer counts. */
	activeSession: Session | null;
	/** `?console=` — the footer's counts are its toggles. */
	console: Pick<ReturnType<typeof useConsoleParam>, "tab" | "toggle">;
}

/**
 * The host's header controls and `footer` — the assistant's trigger,
 * the canvas toolbar over a data canvas, the status metrics for whichever
 * canvas is in front, and the canvas message bar. Returned as the
 * `HostLayout` props they fill.
 */
export function hostChrome(deps: HostChromeDeps) {
	const {
		username,
		graphSlug,
		right,
		dataBoards,
		activeSessionId,
		workCanvas,
		workTarget,
		explorer,
		assistantShown,
		connection,
		dataBoardInFront,
		activeSession,
		console: consoleParam,
	} = deps;
	const { canvas, magnet, toggleMagnet, backend, setBackend } = dataBoards;

	return {
		// One assistant, reachable from every surface. The trigger sits just
		// before the avatar — a persistent control, so it keeps one name
		// wherever you are: `Assistant`, pressed while it holds the right side.
		// Switched off in the user menu, there is no trigger.
		headerPanelControls: assistantShown ? (
			<Button
				variant="ghost"
				size="sm"
				className={cn(
					right.is("assistant") &&
						"bg-primary/15 text-primary ring-1 ring-primary/30 hover:bg-primary/20 hover:text-primary",
				)}
				aria-pressed={right.is("assistant")}
				onClick={() => right.toggle("assistant")}
				title={right.is("assistant") ? "Close the assistant" : "Ask about this"}
			>
				<Star />
				Assistant
			</Button>
		) : undefined,
		// The Explorer's `footer`: the database it stands on, then — with a
		// canvas in front — its counts, which open the console, and the message
		// line; on the right the selection, the zoom and how it draws.
		footer: explorer
			? explorerFooter({
					connection,
					canvas: activeSessionId && dataBoardInFront ? canvas : null,
					backend: dataBoards.backend,
					items: dataBoards.canvasData,
					session: activeSession,
					console: consoleParam,
				})
			: undefined,
		headerCenter:
			!explorer && canvas && activeSessionId ? (
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

function explorerFooter({
	connection,
	canvas,
	backend,
	items,
	session,
	console: consoleParam,
}: {
	connection: GraphConnectionRead | null | undefined;
	canvas: ReturnType<typeof useDataBoards>["canvas"];
	backend: ReturnType<typeof useDataBoards>["backend"];
	items: ReturnType<typeof useDataBoards>["canvasData"];
	session: Session | null;
	console: { tab: ConsoleTab | null; toggle: (tab: ConsoleTab) => void };
}) {
	if (!canvas)
		return {
			left: <ConnectionLine connection={connection} />,
			right: <RendererStatus canvas={null} backend={backend} />,
		};
	const counts = countsOf(items);
	const queries = queryStepsOf(session);
	return {
		left: (
			<span className="flex min-w-0 items-center gap-2">
				<ConnectionLine connection={connection} />
				<ConsoleCounts
					nodes={counts.nodes}
					relationships={counts.relationships}
					queries={queries.length}
					failed={queries.some((q) => q.status === "failed")}
					open={consoleParam.tab}
					onToggle={consoleParam.toggle}
				/>
				<MessageStatus canvas={canvas} />
			</span>
		),
		right: (
			<span className="flex items-center">
				<ViewStatus canvas={canvas} />
				<RendererStatus canvas={canvas} backend={backend} />
			</span>
		),
	};
}
