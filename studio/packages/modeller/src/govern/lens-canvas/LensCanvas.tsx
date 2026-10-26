/**
 * The lens canvas — the global model's schema cards read through a lens.
 *
 * Both Govern pages draw it: the Worlds page with a world picked, the
 * Guardrails page with none, which is the guardrails alone. It is the global
 * model's drawing (`useAllModels` → `buildAllModelsData` → `GlobalModelBoard`)
 * with the engine's `LensView` laid over it by `applyLens`: a hidden type and
 * a guarded property each wear a chip, and a guarded property's hover tag
 * names its guardrail. The canvas re-reads no rule.
 *
 * The board's floating info bar is the page's strip — `title`, `summary` and
 * `selects` are what the page puts in it (`Lens <world> ▾ · Deal hidden · 2
 * guarded` on Worlds). A click on the canvas selects; it opens nothing, since
 * the page beside it is a reading of the lens, not of a type.
 */

import { EmptyState, Spinner } from "@invana/ui";
import {
	type CanvasBackend,
	GlobalModelBoard,
	type GlobalModelSelect,
} from "@invana-studio/canvases";
import { AlertTriangle, Boxes } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { buildAllModelsData } from "../../models/stitch/allModels";
import { useAllModels } from "../../models/stitch/useAllModels";
import type { LensView } from "../types";
import { applyLens } from "./lensMarks";

export interface LensCanvasProps {
	username: string;
	graphSlug: string;
	/** The engine's compile; absent while it is read. */
	view?: LensView;
	/** The strip's name for the reading — `Lens`, `Guardrails`. */
	title: string;
	/** What the strip counts, as one line. */
	summary?: string;
	/** Pickers in the strip — the world on the Worlds page. */
	selects?: GlobalModelSelect[];
	backend?: CanvasBackend;
	/** Floating over the bottom of the canvas. */
	children?: ReactNode;
}

export function LensCanvas({
	username,
	graphSlug,
	view,
	title,
	summary,
	selects,
	backend,
	children,
}: LensCanvasProps) {
	const { frames, links, isLoading, isError, error } = useAllModels(
		username,
		graphSlug,
	);
	const base = useMemo(
		() => buildAllModelsData(frames, links).data,
		[frames, links],
	);
	const data = useMemo(() => applyLens(base, view), [base, view]);

	if (isError) {
		return (
			<div className="flex h-full w-full items-center justify-center p-6">
				<EmptyState
					icon={<AlertTriangle />}
					title="The models could not be read"
					description={
						error instanceof Error
							? error.message
							: "The engine did not answer for this graph."
					}
				/>
			</div>
		);
	}
	if (isLoading) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	if (frames.length === 0) {
		return (
			<div className="flex h-full w-full items-center justify-center p-6">
				<EmptyState
					icon={<Boxes />}
					title="No models yet"
					description="A lens is read on the Graph's models. Author one, or import a starter, and it is drawn here."
				/>
			</div>
		);
	}
	return (
		<GlobalModelBoard
			data={data}
			title={title}
			summary={summary}
			selects={selects}
			backend={backend}
		>
			{children}
		</GlobalModelBoard>
	);
}
