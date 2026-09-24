/**
 * G1 · the guardrails in force, G2 · the rule builder, and the impact a save
 * would have on every world that narrows inside them.
 *
 * *As someone accountable for this Graph, I want to read the bound every run
 * is inside — including the ones I did not write — so that working within it is
 * something I can do deliberately rather than by trial and refusal.*
 *
 * **It sits under Worlds**, which is where a person arrives. The ceiling is
 * still read first — the locked strip at the top of that drawer states it (W4)
 * — and this drawer is where its rules are read in full.
 *
 * **Readable by everyone, editable by a permission**
 * ([GR5](../../../../../docs/for-developers/modules/govern/features/guardrails.md)):
 * a bound nobody may read is a bound nobody can work within, so the rules
 * render whatever `can_edit_guardrails` says — and every authoring control is
 * **absent**, never greyed, when it is false.
 *
 * **A save asks what it would cost first**
 * ([GR2](../../../../../docs/for-developers/modules/govern/features/guardrails.md)).
 * Every world is revalidated and what each one loses is named before the write,
 * because a guardrail that silently invalidates six worlds is one whose effect
 * nobody saw at the moment they signed for it.
 */

import { LensActions } from "@/pages/graphs-detail/features/govern/LensActions";
import { LensDetail } from "@/pages/graphs-detail/features/govern/LensDetail";
import { LensEditor } from "@/pages/graphs-detail/features/govern/LensEditor";
import { LensList } from "@/pages/graphs-detail/features/govern/LensList";
import { NEW_LENS } from "@/pages/graphs-detail/features/govern/WorldsDrawer";
import {
	type TaskDrawerUi,
	taskDrawerSection,
} from "@/pages/graphs-detail/shared/TaskDrawer";
import type { Lens, LensCreate, Refusal } from "@/types/govern";
import type { PanelStackSection } from "@invana/ui";
import { Maximize2, Plus, ShieldCheck } from "lucide-react";

export interface GuardrailsDrawerProps {
	ui: TaskDrawerUi;
	username?: string;
	graphSlug?: string;
	items: Lens[];
	isLoading: boolean;
	error: unknown;
	guardrailId: string | null;
	onOpenGuardrail: (id: string | null) => void;
	/**
	 * `More` on the drill-in header — reopens this guardrail's board (GR14).
	 * Offered to everyone who can read the rules: the board reads, and reading
	 * the bound is not the permission ([GR5](../../../../../docs/for-developers/modules/govern/features/guardrails.md)).
	 */
	onOpenBoard?: (id: string) => void;
	/** The one field-level permission in the product (GV22). */
	mayEditGuardrails: boolean;
	editingId: string | null;
	onEdit: (id: string | null) => void;
	onSave: (payload: LensCreate, lensId?: string) => void;
	isSaving?: boolean;
	saveRefusals?: Refusal[];
	defaultSize?: number | string;
}

export function guardrailsDrawerSection({
	ui,
	username,
	graphSlug,
	items,
	isLoading,
	error,
	guardrailId,
	onOpenGuardrail,
	onOpenBoard,
	mayEditGuardrails,
	editingId,
	onEdit,
	onSave,
	isSaving,
	saveRefusals,
	defaultSize,
}: GuardrailsDrawerProps): PanelStackSection {
	const authoring = guardrailId === NEW_LENS;
	const drilled = authoring
		? null
		: (items.find((l) => l.id === guardrailId) ?? null);
	const editing = drilled && editingId === drilled.id ? drilled : null;

	return taskDrawerSection(
		{
			id: "guardrails",
			label: "Guardrails",
			icon: ShieldCheck,
			// `0` is a fact worth printing: *nothing is set* reads differently from
			// *not loaded yet*, and the count has to read while the drawer is shut.
			count: isLoading ? undefined : `${items.length} in force`,
			trail: authoring ? "New guardrail" : drilled?.display_name,
			onBack: () => {
				onEdit(null);
				onOpenGuardrail(null);
			},
			detailActions:
				drilled && onOpenBoard
					? [
							{
								key: "more",
								name: "Open this guardrail as a page",
								icon: Maximize2,
								onClick: () => onOpenBoard(drilled.id),
							},
						]
					: undefined,
			// Absent without the permission, never disabled — a greyed `+` promises
			// a form this person cannot submit.
			headerActions: mayEditGuardrails
				? [
						{
							key: "new",
							name: "New guardrail",
							icon: Plus,
							onClick: () => onOpenGuardrail(NEW_LENS),
						},
					]
				: undefined,
			defaultSize,
			children: () => {
				if (authoring || editing) {
					return (
						<div className="px-3 py-2">
							<LensEditor
								username={username}
								graphSlug={graphSlug}
								kind="guardrail"
								lens={editing}
								isSaving={isSaving}
								saveRefusals={saveRefusals}
								onSave={(payload) => onSave(payload, editing?.id)}
								onCancel={() => {
									onEdit(null);
									if (authoring) onOpenGuardrail(null);
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
									onGone={() => onOpenGuardrail(null)}
									onOpen={(id) => onOpenGuardrail(id)}
								/>
							</LensDetail>
						</div>
					);
				}

				return (
					<LensList
						items={items}
						isLoading={isLoading}
						error={error}
						selectedId={guardrailId}
						onSelect={(id) => onOpenGuardrail(id)}
						loadingLine="reading what is in force"
						errorTitle="Could not read this Graph's guardrails"
						emptyLine="None set — every configured provider, every third party your agents can reach, and the whole global model are in view. A run is bounded by whichever world it is asked under, and by nothing above it."
					/>
				);
			},
		},
		ui,
	);
}
