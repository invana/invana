import { canUseWebGPU, hasWebGL, isWebKit } from "@invana/canvas-react";
import { Alert, AlertDescription, AlertTitle, Button } from "@invana/ui";
import { MonitorX, X, Zap } from "lucide-react";
import { useState } from "react";

/**
 * Capability banner overlaid on the graph canvas (Explorer + Modeller). The
 * canvas needs one of WebGPU / WebGL to render; this surfaces the degraded cases:
 *
 * - **Neither** usable → destructive, non-dismissible: the canvas can't render at
 *   all on this browser.
 * - **No WebGPU, WebGL fine** → amber, dismissible: we fall back to WebGL (e.g.
 *   Safari/WebKit, where PixiJS WebGPU crashes — see {@link isWebKit}), and
 *   explain why the WebGPU toggle is off.
 * - **Both available** → renders nothing.
 *
 * Uses the synchronous capability utils from `@invana/canvas` — `canUseWebGPU`
 * (API present and not WebKit) and the `hasWebGL` floor. This reflects what the
 * browser can *select*, which matches the toggle gating; the engine still
 * downgrades to WebGL at init if a selected WebGPU adapter can't initialise (a
 * blocklisted driver), a case this notice doesn't separately surface.
 *
 * Positioned absolutely at the top of the canvas host (a `relative` wrapper); the
 * wrapper is click-through (`pointer-events-none`) so only the alert itself
 * intercepts clicks.
 */
export function RendererCapabilityBanner() {
	const webgpu = canUseWebGPU();
	const webgl = hasWebGL();
	const [dismissed, setDismissed] = useState(false);

	// Best case — WebGPU is usable (the most performant backend), nothing to say.
	if (webgpu) return null;

	const wrap =
		"pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-3";

	if (!webgl) {
		return (
			<div className={wrap}>
				<Alert
					variant="destructive"
					className="pointer-events-auto max-w-xl shadow-lg"
				>
					<MonitorX className="h-4 w-4" />
					<AlertTitle>Graph canvas can't render</AlertTitle>
					<AlertDescription>
						This browser supports neither WebGPU nor WebGL, which the graph
						canvas needs to draw. Try a recent version of Chrome, Edge, or
						Firefox, or enable hardware acceleration in your browser settings.
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	if (dismissed) return null;

	return (
		<div className={wrap}>
			<Alert className="pointer-events-auto max-w-xl border-amber-500/50 text-amber-900 shadow-lg dark:text-amber-200 [&>svg]:text-amber-600">
				<Zap className="h-4 w-4" />
				<AlertTitle>Using WebGL — WebGPU unavailable</AlertTitle>
				<AlertDescription className="flex items-start gap-2">
					<span>
						{isWebKit()
							? "Safari doesn't support WebGPU for this renderer yet, so the canvas is using WebGL."
							: "WebGPU isn't available in this browser, so the canvas is using WebGL."}{" "}
						Rendering works as normal; very large graphs may be faster with
						WebGPU (available in recent Chrome / Edge).
					</span>
					<Button
						size="icon"
						variant="ghost"
						className="-mr-1 -mt-1 h-6 w-6 shrink-0"
						onClick={() => setDismissed(true)}
						aria-label="Dismiss"
					>
						<X className="h-4 w-4" />
					</Button>
				</AlertDescription>
			</Alert>
		</div>
	);
}
