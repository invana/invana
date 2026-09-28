/**
 * **Govern** — one rail icon, one panel, two sections (GV17 · G32 · G33).
 *
 * `Worlds` over `Guardrails`, stacked, with no panel header above them: the
 * first section header is the top of the column, and the breadcrumb already says
 * which panel is open (G16).
 *
 * **Worlds leads and carries the ceiling with it.** A person arrives at Govern
 * to see which world a question can go under, so that list is on top; the
 * guardrails ride above it as a locked strip (W4), which states what is in
 * force without spending a section's height on one or two rows. The Guardrails
 * section below is where those rules are read in full (G1), and the strip's one
 * control is the way down to it.
 *
 * **One query, split by `kind`.** A guardrail and a world are one record
 * separated by `kind` (GV1), so both sections read one list rather than two
 * endpoints — a second fetch would be the second enforcement path this module
 * exists not to have. The same response carries `may_edit_guardrails`, which is
 * why the permission never lands at a different moment from the rules it
 * governs.
 *
 * **The panel owns the write.** Both sections author the same record through the
 * same two mutations, and the guardrail save is the one that has to ask what it
 * would cost first (GR2) — so the impact dialog lives here, above both, rather
 * than inside the section that raised it.
 *
 * It opens no canvas. A world is the bound the *other* panels run inside, so it
 * hangs over whatever is already drawn.
 *
 * **A drill-in opens the record's board beside the section**
 * ([WO15](../../../../../docs/for-developers/modules/govern/features/worlds.md) ·
 * [GR14](../../../../../docs/for-developers/modules/govern/features/guardrails.md)),
 * titled with the lens's own name. The section stays the **picking** reading —
 * 420px of rules, with the run that prompted the narrowing still open — and the
 * board is the **auditing** one, which is the reading `Save report` can keep.
 */

import {
	useCreateLensMutation,
	useGuardrailImpactMutation,
	useLensesQuery,
	useUpdateLensMutation,
} from "@/hooks/queries/useGovern";
import { guardrailsSection } from "@/pages/graphs-detail/features/lenses/GuardrailsSection";
import { ImpactDialog } from "@/pages/graphs-detail/features/lenses/ImpactDialog";
import {
	NEW_LENS,
	worldsSection,
} from "@/pages/graphs-detail/features/lenses/WorldsSection";
import { useStackSectionUi } from "@/pages/graphs-detail/shared/StackSection";
import {
	type GovernSectionKey,
	useLensesViewPanel,
} from "@/pages/graphs-detail/shell/useLensesViewPanel";
import { ApiError } from "@/services/api/client";
import type { LensCreate, LensKind, Refusal } from "@/types/govern";
import { PanelStack, type PanelStackHandle } from "@invana/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export interface LensesViewPanelProps {
	username?: string;
	graphSlug?: string;
	/**
	 * Open this lens as a page — `world:<id>` or `guardrail:<id>` (WO15 · GR14).
	 * Absent on a surface with no page host, and then a drill-in is the section
	 * alone rather than a control that fails.
	 */
	onOpenBoard?: (kind: LensKind, lensId: string) => void;
}

/** A save the impact dialog is standing in front of. */
interface PendingSave {
	payload: LensCreate;
	lensId?: string;
}

export function LensesViewPanel({
	username,
	graphSlug,
	onOpenBoard,
}: LensesViewPanelProps) {
	const govern = useLensesViewPanel();
	const ui = useStackSectionUi();
	const { data, isLoading, error } = useLensesQuery(username, graphSlug);

	// Which record is being edited **in place**. In-memory: a half-written form
	// is a reading of this session, not a place a link carries — `&world=new`
	// is, and does survive a reload.
	const [editingId, setEditingId] = useState<string | null>(null);
	const [pending, setPending] = useState<PendingSave | null>(null);
	const [refusals, setRefusals] = useState<Refusal[] | undefined>();

	const create = useCreateLensMutation(username, graphSlug);
	const update = useUpdateLensMutation(username, graphSlug);
	const impact = useGuardrailImpactMutation(username, graphSlug);

	const { worlds, guardrails } = useMemo(() => {
		const items = data?.items ?? [];
		return {
			worlds: items.filter((l) => l.kind === "world"),
			guardrails: items.filter((l) => l.kind === "guardrail"),
		};
	}, [data]);

	// Absent until the list answers. Defaulting to `true` would draw controls
	// for a second and then take them away, which reads as a permission being
	// revoked while somebody watches.
	const mayEditGuardrails = data?.may_edit_guardrails ?? false;

	const isSaving = create.isPending || update.isPending;

	const write = ({ payload, lensId }: PendingSave) => {
		setRefusals(undefined);
		const done = () => {
			setPending(null);
			setEditingId(null);
			govern.openWorld(null);
			govern.openGuardrail(null);
			toast.success(
				payload.kind === "guardrail" ? "Guardrail saved" : "World saved",
			);
		};
		const failed = (err: unknown) => {
			setPending(null);
			// A refusal from the save is the same shape as one from the dry run, so
			// the form shows it in the same place — on the rule that caused it.
			const detail =
				err instanceof ApiError
					? (err.detail as { refusals?: Refusal[] } | undefined)
					: undefined;
			if (detail?.refusals?.length) setRefusals(detail.refusals);
			else
				toast.error(
					err instanceof Error ? err.message : "The save was refused",
				);
		};

		(lensId
			? update.mutateAsync({
					id: lensId,
					data: {
						name: payload.name,
						rules: payload.rules,
						cast: payload.cast,
						closed_layers: payload.closed_layers,
						as_of: payload.as_of,
					},
				})
			: create.mutateAsync(payload)
		)
			.then(done)
			.catch(failed);
	};

	// A guardrail save reads what it would cost **before** the write; a world
	// save does not, because a world narrows only itself.
	const onSave = (payload: LensCreate, lensId?: string) => {
		if (payload.kind !== "guardrail") return write({ payload, lensId });
		setPending({ payload, lensId });
		impact.mutate({
			rules: payload.rules,
			closed_layers: payload.closed_layers,
			scope: payload.scope ?? "graph",
		});
	};

	// The section named by `?section=` opens with more of the column, and the other
	// keeps enough to read its list. `PanelStack` reads `defaultSize` at
	// **mount**, so this is the opening split only (G35) — after that it is the
	// reader's.
	//
	// **A Graph has one or two guardrails and several worlds**, so the split is
	// not even: an even one spends half the column on a single row.
	const size = (d: GovernSectionKey) =>
		d === "worlds"
			? govern.sectionKey === "worlds"
				? "75%"
				: "55%"
			: govern.sectionKey === "guardrails"
				? "45%"
				: "25%";

	// A drill-in expands the section holding it — the URL now names something to
	// look at, and rendering it into a section that was collapsed makes the click
	// look like it did nothing (G35).
	const stackRef = useRef<PanelStackHandle>(null);
	const focused =
		govern.sectionKey === "worlds" ? govern.worldId : govern.guardrailId;
	// `focused` is a trigger, not a value: the effect re-runs when the drill-in
	// moves but never reads it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above.
	useEffect(() => {
		stackRef.current?.expand(govern.sectionKey);
	}, [govern.sectionKey, focused]);

	// **What is drilled into is what is on the board** (WO15 · GR14).
	//
	// It is an effect and not the row's click handler because opening the board
	// writes `?page=`, drilling in writes `?world=`, and the two hooks hold
	// their own copy of the query string: called in one handler, the second
	// write is composed against the string as it was before the first, and the
	// drill-in it was meant to accompany disappears. Waiting for the drill-in to
	// commit is what makes them two keys of one URL rather than two writers of
	// it.
	//
	// It also means a **cold link** — `?panel=govern&world=<id>`, shared or
	// reloaded — arrives with its board open, which is the property that makes
	// the page id worth carrying at all.
	//
	// `&world=new` names no record yet, so authoring opens no board.
	//
	// Once per drill-in, not per render: `onOpenBoard` is new on every URL
	// write, so keyed on it alone this would pull the lens page back to the
	// front each time another page took focus.
	const openedLens = useRef<string | null>(null);
	useEffect(() => {
		if (!onOpenBoard) return;
		const kind = govern.sectionKey === "worlds" ? "world" : "guardrail";
		const lens = focused && focused !== NEW_LENS ? `${kind}:${focused}` : null;
		if (openedLens.current === lens) return;
		openedLens.current = lens;
		if (focused && lens) onOpenBoard(kind, focused);
	}, [govern.sectionKey, focused, onOpenBoard]);

	return (
		<>
			<PanelStack
				withHandle
				stackRef={stackRef}
				className="h-full"
				headerHeight={30}
				sections={[
					worldsSection({
						ui,
						username,
						graphSlug,
						items: worlds,
						guardrails,
						isLoading,
						error,
						worldId: govern.worldId,
						onOpenWorld: govern.openWorld,
						onOpenBoard: onOpenBoard
							? (id) => onOpenBoard("world", id)
							: undefined,
						onReadGuardrails: () => govern.focus("guardrails"),
						mayEditGuardrails,
						editingId,
						onEdit: setEditingId,
						onSave,
						isSaving,
						saveRefusals: refusals,
						defaultSize: size("worlds"),
					}),
					guardrailsSection({
						ui,
						username,
						graphSlug,
						items: guardrails,
						isLoading,
						error,
						guardrailId: govern.guardrailId,
						onOpenGuardrail: govern.openGuardrail,
						onOpenBoard: onOpenBoard
							? (id) => onOpenBoard("guardrail", id)
							: undefined,
						mayEditGuardrails,
						editingId,
						onEdit: setEditingId,
						onSave,
						isSaving,
						saveRefusals: refusals,
						defaultSize: size("guardrails"),
					}),
				]}
			/>

			<ImpactDialog
				open={Boolean(pending)}
				onOpenChange={(open) => {
					if (!open) setPending(null);
				}}
				impact={impact.data}
				isLoading={impact.isPending}
				isSaving={isSaving}
				onConfirm={() => pending && write(pending)}
			/>
		</>
	);
}
