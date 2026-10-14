/**
 * The world and guardrail board, as a page — artboards `GovWorld` ·
 * `GovGuardrails` ([the-screens.md](../../../../../../docs/for-developers/the-screens.md)).
 *
 * **One page for both kinds**, because they are one record separated by `kind`
 * ([spec.md](../../../../../../docs/for-developers/modules/govern/spec.md) ·
 * [worlds.md](../../../../../../docs/for-developers/modules/govern/features/worlds.md)).
 *
 * The detail read is what carries the usage and the **resolved** cast —
 * *innermost wins, then the address is checked against the effective rules*
 * ([spec.md](../../../../../../docs/for-developers/modules/govern/spec.md)) is a
 * composition against the guardrails only the server can do. Editing is the
 * `model` role's; without it `Edit` shows disabled.
 *
 * **The board reads; the acts stay in the section**
 * ([worlds.md](../../../../../../docs/for-developers/modules/govern/features/worlds.md)).
 * `Edit` puts the Govern panel back on this lens, drilled in — it is the only
 * action here that leads to a write.
 */

import { Board } from "@invana/boards";
import { EmptyState, Spinner } from "@invana/ui";
import type { LensKind } from "@invana-studio/core";
import { useAccess, useReport, VIEW_BOARD } from "@invana-studio/shell";
import { BOARD_ICONS } from "@invana-studio/ui";
import { useMemo, useState } from "react";
import { useLensQuery } from "../queries";
import { LENS_ACTIONS, lensBoardSpec } from "./lensBoardSpec";

export interface LensBoardPageProps {
	username: string;
	graphSlug: string;
	/** Which of the two names this page is under — it changes what it says. */
	kind: LensKind;
	/** The `lenses.id` every panel binds to. */
	lensId: string;
	/** `Edit` — puts the Govern section back on this lens, drilled in. */
	onEdit: (kind: LensKind, lensId: string) => void;
}

export function LensBoardPage({
	username,
	graphSlug,
	kind,
	lensId,
	onEdit,
}: LensBoardPageProps) {
	const detail = useLensQuery(username, graphSlug, lensId);
	const [view, setView] = useState(VIEW_BOARD);

	const lens = detail.data ?? null;
	// Editing a world or a guardrail is the `model` role's; without it `Edit`
	// shows disabled rather than going missing.
	const mayEdit = useAccess().gate("model").allowed;

	const spec = useMemo(
		() => (lens ? lensBoardSpec(lens, { view, mayEdit }) : null),
		[lens, view, mayEdit],
	);

	// `Save report` on the header, and the act behind it. What it keeps is
	// `spec` — this page's reading, resolved — never the lens.
	const report = useReport(spec);

	if (detail.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	if (!lens || !spec || !report) {
		return (
			<EmptyState
				className="h-full"
				title={
					kind === "guardrail" ? "This guardrail is gone" : "This world is gone"
				}
				description="It was deleted, or it belongs to a Graph this account can no longer read. The bound every run is inside is still the one the Guardrails drawer states."
			/>
		);
	}

	return (
		<Board
			className="h-full min-h-0"
			spec={report.spec}
			icons={BOARD_ICONS}
			onAction={(id, ctx) => {
				if (report.handle(id)) return;
				switch (id) {
					case LENS_ACTIONS.view:
						if (ctx?.option) setView(ctx.option);
						return;
					case LENS_ACTIONS.edit:
						onEdit(lens.kind, lensId);
						return;
					default:
						return;
				}
			}}
		/>
	);
}
