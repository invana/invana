/**
 * The Worlds page — a world read on the model.
 *
 * The lens canvas under the picked world, with the world inspector in the
 * page's right column. Both read one `GET …/govern/view?world=<id>`, so
 * *hidden*, *sliced* and *guarded* are the engine's compile and the canvas
 * and the inspector cannot disagree.
 *
 * | Region | What |
 * |---|---|
 * | the canvas's strip | `Lens <world> ▾ · Deal hidden · 2 guarded` — the world is picked here and rides `?world=` |
 * | the right column | the world inspector — Sees · Answers go · Used by, *Open board*, *Next: guardrails* |
 * | a modal | the world's editor, while `?edit=1` (the world board's *Edit*) or the inspector's *Edit* |
 *
 * With no world in the URL the first named world opens; with none at all the
 * canvas is the guardrails alone and the inspector says how to make one.
 * The world's own read (`useLensQuery`) is what the breadcrumb names it from.
 */

import type { CanvasBackend } from "@invana-studio/canvases";
import { type Lens, useLensesQuery } from "@invana-studio/core";
import { usePageParams } from "@invana-studio/shell";
import { useCallback } from "react";
import { LensCanvas } from "../lens-canvas/LensCanvas";
import { useGuardrailsQuery, useLensQuery, useLensViewQuery } from "../queries";
import { EDIT_PARAM, useLensesViewPanel } from "../useLensesViewPanel";
import { WorldDialog } from "./WorldDialog";
import { WorldInspector } from "./WorldInspector";

export interface WorldsPageProps {
	username: string;
	graphSlug: string;
	backend?: CanvasBackend;
	/** *Open board* in the world inspector. */
	onOpenWorldBoard: (worldId: string) => void;
}

const NO_WORLD = "none";

/** `Deal hidden`, `Deal · Order hidden`, `Deal · Order +2 hidden`. */
function hiddenLine(types: string[]): string | null {
	if (!types.length) return null;
	const shown = types.slice(0, 2).join(" · ");
	const more = types.length > 2 ? ` +${types.length - 2}` : "";
	return `${shown}${more} hidden`;
}

/** The world on screen: the URL's, else the first named one. */
export function useShownWorld(
	username: string | undefined,
	graphSlug: string | undefined,
): { worldId: string | null; worlds: Lens[]; total?: number } {
	const { worldId } = useLensesViewPanel();
	const list = useLensesQuery(username, graphSlug, { kind: "world" });
	const worlds = list.data?.items ?? [];
	return {
		worldId: worldId ?? worlds.find((w) => w.is_named)?.id ?? null,
		worlds,
		total: list.data?.total,
	};
}

export function WorldsPage({
	username,
	graphSlug,
	backend,
	onOpenWorldBoard,
}: WorldsPageProps) {
	const govern = useLensesViewPanel();
	const [params, setParams] = usePageParams();
	const { worldId, worlds } = useShownWorld(username, graphSlug);
	const view = useLensViewQuery(username, graphSlug, worldId);
	const lens = useLensQuery(username, graphSlug, worldId ?? undefined);
	const mayEdit = useGuardrailsQuery(username, graphSlug).data?.may_edit;

	// The page may stay mounted behind another; only its own section edits.
	const editing =
		params.get(EDIT_PARAM) === "1" &&
		govern.sectionKey === "worlds" &&
		!!mayEdit &&
		!!lens.data;

	const setEdit = useCallback(
		(on: boolean) =>
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					if (on) next.set(EDIT_PARAM, "1");
					else next.delete(EDIT_PARAM);
					return next;
				},
				{ replace: true },
			),
		[setParams],
	);

	const v = view.data;
	const summary = v
		? [hiddenLine(v.hidden_types), `${v.guarded} guarded`]
				.filter(Boolean)
				.join(" · ")
		: undefined;

	return (
		<div className="flex h-full min-h-0 w-full">
			<div className="relative min-h-0 min-w-0 flex-1">
				<LensCanvas
					username={username}
					graphSlug={graphSlug}
					view={v}
					backend={backend}
					title="Lens"
					summary={summary}
					selects={[
						{
							key: "world",
							label: "World",
							value: worldId ?? NO_WORLD,
							options: worldId
								? Object.fromEntries(worlds.map((w) => [w.id, w.display_name]))
								: {
										[NO_WORLD]: "none",
										...Object.fromEntries(
											worlds.map((w) => [w.id, w.display_name]),
										),
									},
							onChange: (id) => {
								if (id !== NO_WORLD) govern.openWorld(id);
							},
						},
					]}
				/>
			</div>
			<aside className="flex min-h-0 w-104 shrink-0 flex-col border-l bg-card">
				<WorldInspector
					name={lens.data?.display_name}
					view={worldId ? v : undefined}
					isLoading={view.isLoading}
					mayEdit={!!mayEdit}
					onEdit={() => setEdit(true)}
					onOpenBoard={() => worldId && onOpenWorldBoard(worldId)}
					onNextGuardrails={() => govern.focus("guardrails")}
				/>
			</aside>
			<WorldDialog
				username={username}
				graphSlug={graphSlug}
				open={editing}
				lens={editing ? (lens.data ?? null) : null}
				onClose={() => setEdit(false)}
				onSaved={(id) => govern.openWorld(id)}
				onGone={() => govern.openWorld(null)}
			/>
		</div>
	);
}
