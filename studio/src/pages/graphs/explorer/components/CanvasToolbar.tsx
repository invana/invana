// TEMP: zoom/fit buttons need the canvas instance from @invana/canvas-core
// (currently unavailable — see GraphCanvas.tsx). Rendered as no-ops until the
// new canvas integration lands; kept as a component so the explorer layout
// stays stable.

import { Button } from "@invana/ui";
import { Maximize, ZoomIn, ZoomOut } from "lucide-react";

interface CanvasToolbarProps {
	canvas: unknown;
}

export function CanvasToolbar(_: CanvasToolbarProps) {
	return (
		<div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
			<Button variant="outline" size="icon" className="h-7 w-7" disabled>
				<ZoomIn className="w-3.5 h-3.5" />
			</Button>
			<Button variant="outline" size="icon" className="h-7 w-7" disabled>
				<ZoomOut className="w-3.5 h-3.5" />
			</Button>
			<Button variant="outline" size="icon" className="h-7 w-7" disabled>
				<Maximize className="w-3.5 h-3.5" />
			</Button>
		</div>
	);
}
