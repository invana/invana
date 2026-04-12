import type { Canvas } from "@invana/canvas-core";
import { Button } from "@invana/ui";
import { Maximize, ZoomIn, ZoomOut } from "lucide-react";

interface CanvasToolbarProps {
	canvas: Canvas | null;
}

export function CanvasToolbar({ canvas }: CanvasToolbarProps) {
	const zoomIn = () => {
		if (!canvas) return;
		const vp = canvas.viewport;
		if (vp) vp.zoom(vp.scaled * 1.25, true);
	};

	const zoomOut = () => {
		if (!canvas) return;
		const vp = canvas.viewport;
		if (vp) vp.zoom(vp.scaled * 0.8, true);
	};

	const fitView = () => {
		if (!canvas) return;
		const vp = canvas.viewport;
		if (vp) vp.fit(true);
	};

	return (
		<div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
			<Button
				variant="outline"
				size="icon"
				className="h-7 w-7"
				onClick={zoomIn}
			>
				<ZoomIn className="w-3.5 h-3.5" />
			</Button>
			<Button
				variant="outline"
				size="icon"
				className="h-7 w-7"
				onClick={zoomOut}
			>
				<ZoomOut className="w-3.5 h-3.5" />
			</Button>
			<Button
				variant="outline"
				size="icon"
				className="h-7 w-7"
				onClick={fitView}
			>
				<Maximize className="w-3.5 h-3.5" />
			</Button>
		</div>
	);
}
