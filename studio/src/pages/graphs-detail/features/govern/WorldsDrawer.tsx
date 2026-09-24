/**
 * W1 · the worlds a question can be asked under, W2 · one of them read in full,
 * W3 · authoring one, and W4 · the ladder that publishes and promotes it.
 *
 * *As someone about to ask a question of this Graph, I want to see which worlds
 * I can put it under and what each one narrows, so that picking a bound is a
 * comparison rather than a memory test.*
 *
 * It **leads the stack**, and carries the ceiling with it: the guardrails are a
 * locked strip at the top of the list (W4), so every world is read as *narrower
 * than this* rather than as the whole bound. The Guardrails drawer below is
 * where those rules are read in full (GV17).
 *
 * **Authoring opens inside the drawer, not over it.** `&world=new` is the
 * drill-in like any other, so the ceiling stays a scroll away and the run that
 * prompted the narrowing stays open in `mainSection` — which is the property
 * Journey 2 exists to protect.
 */

import { GuardrailsStrip } from "@/pages/graphs-detail/features/govern/GuardrailsStrip";
import { LensActions } from "@/pages/graphs-detail/features/govern/LensActions";
import { LensDetail } from "@/pages/graphs-detail/features/govern/LensDetail";
import { LensEditor } from "@/pages/graphs-detail/features/govern/LensEditor";
import { LensList } from "@/pages/graphs-detail/features/govern/LensList";
import {
	type TaskDrawerUi,
	taskDrawerSection,
} from "@/pages/graphs-detail/shared/TaskDrawer";
import type { Lens, LensCreate, Refusal } from "@/types/govern";
import type { PanelStackSection } from "@invana/ui";
import { Globe, Maximize2, Plus } from "lucide-react";

/** `&world=new` is the authoring drill-in — a value, not a second param. */
export const NEW_LENS = "new";

export interface WorldsDrawerProps {
	ui: TaskDrawerUi;
	username?: string;
	graphSlug?: string;
	items: Lens[];
	/** The ceiling, for the locked strip above the list. */
	guardrails: Lens[];
	isLoading: boolean;
	error: unknown;
	worldId: string | null;
	onOpenWorld: (id: string | null) => void;
	/**
	 * `More` on the drill-in header — reopens this world's board (WO15). The
	 * drill-in opens it already; this is the way back after the tab is closed,
	 * and it is absent on a surface with no page host.
	 */
	onOpenBoard?: (id: string) => void;
	/** Give the Guardrails drawer the height — the strip's one control. */
	onReadGuardrails: () => void;
	/** Whether the promote control is drawn at all (GV22 · GR5). */
	mayEditGuardrails: boolean;
	/** Which world is being edited in place, and how to say so. */
	editingId: string | null;
	onEdit: (id: string | null) => void;
	onSave: (payload: LensCreate, lensId?: string) => void;
	isSaving?: boolean;
	saveRefusals?: Refusal[];
	defaultSize?: number | string;
}

export function worldsDrawerSection({
	ui,
	username,
	graphSlug,
	items,
	guardrails,
	isLoading,
	error,
	worldId,
	onOpenWorld,
	onOpenBoard,
	onReadGuardrails,
	mayEditGuardrails,
	editingId,
	onEdit,
	onSave,
	isSaving,
	saveRefusals,
	defaultSize,
}: WorldsDrawerProps): PanelStackSection {
	const authoring = worldId === NEW_LENS;
	const drilled = authoring
		? null
		: (items.find((l) => l.id === worldId) ?? null);
	const editing = drilled && editingId === drilled.id ? drilled : null;

	return taskDrawerSection(
		{
			id: "worlds",
			label: "Worlds",
			icon: Globe,
			count: isLoading ? undefined : `${items.length} to pick from`,
			trail: authoring ? "New world" : drilled?.display_name,
			onBack: () => {
				onEdit(null);
				onOpenWorld(null);
			},
			// An act on the one record on screen (G43) — the board this drill-in
			// already opened, found again after its tab was closed.
			detailActions:
				drilled && onOpenBoard
					? [
							{
								key: "more",
								name: "Open this world as a page",
								icon: Maximize2,
								onClick: () => onOpenBoard(drilled.id),
							},
						]
					: undefined,
			// The one thing this drawer creates, in the drawer that owns it (G3).
			headerActions: [
				{
					key: "new",
					name: "New world",
					icon: Plus,
					onClick: () => onOpenWorld(NEW_LENS),
				},
			],
			defaultSize,
			children: () => {
				if (authoring || editing) {
					return (
						<div className="px-3 py-2">
							<LensEditor
								username={username}
								graphSlug={graphSlug}
								kind="world"
								lens={editing}
								isSaving={isSaving}
								saveRefusals={saveRefusals}
								onSave={(payload) => onSave(payload, editing?.id)}
								onCancel={() => {
									onEdit(null);
									if (authoring) onOpenWorld(null);
								}}
							/>
						</div>
					);
				}

				if (drilled) {
					return (
						<div className="px-3 py-2">
							<LensDetail
								lens={drilled}
								username={username}
								graphSlug={graphSlug}
							>
								<LensActions
									username={username}
									graphSlug={graphSlug}
									lens={drilled}
									mayEditGuardrails={mayEditGuardrails}
									onEdit={() => onEdit(drilled.id)}
									onGone={() => onOpenWorld(null)}
									onOpen={(id) => onOpenWorld(id)}
								/>
							</LensDetail>
						</div>
					);
				}

				return (
					<div className="flex min-w-0 flex-col">
						{/* The strip shows even when there are no worlds (W1's empty
						    seam): what is in force does not depend on anyone having
						    written a world. It is absent only when the Graph has no
						    guardrail at all, which the Guardrails drawer states in a
						    sentence of its own. */}
						{guardrails.length ? (
							<div className="px-3 pt-2">
								<GuardrailsStrip
									guardrails={guardrails}
									onRead={onReadGuardrails}
								/>
							</div>
						) : null}
						<LensList
							items={items}
							isLoading={isLoading}
							error={error}
							selectedId={worldId}
							onSelect={(id) => onOpenWorld(id)}
							loadingLine="reading this Graph's worlds"
							errorTitle="Could not read this Graph's worlds"
							emptyLine="None yet — a question sees the whole model, inside the guardrails above."
						/>
					</div>
				);
			},
		},
		ui,
	);
}
