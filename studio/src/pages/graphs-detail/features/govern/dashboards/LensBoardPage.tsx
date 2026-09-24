/**
 * The world and guardrail board, as a page — artboards `GovWorld` ·
 * `GovGuardrails` ([W2 · G1](../../../../../../docs/for-developers/the-screens.md)).
 *
 * **One page for both kinds**, because they are one record separated by `kind`
 * ([GV1](../../../../../../docs/for-developers/modules/govern/spec.md) ·
 * [WO15](../../../../../../docs/for-developers/modules/govern/features/worlds.md)).
 *
 * Two reads, and the page draws on the first. The detail read is what carries
 * the usage and the **resolved** cast — *innermost wins, then the address is
 * checked against the effective rules*
 * ([GV6](../../../../../../docs/for-developers/modules/govern/spec.md)) is a
 * composition against the guardrails only the server can do — and the list read
 * is where `may_edit_guardrails` rides
 * ([GR11](../../../../../../docs/for-developers/modules/govern/features/guardrails.md)),
 * so the permission never lands at a different moment from the rules it
 * governs.
 *
 * **The board reads; the acts stay in the drawer**
 * ([WO16](../../../../../../docs/for-developers/modules/govern/features/worlds.md)).
 * `Edit` puts the Govern panel back on this lens, drilled in — it is the only
 * action here that leads to a write.
 */

import { useLensQuery, useLensesQuery } from "@/hooks/queries/useGovern";
import { useReport } from "@/pages/graphs-detail/features/boards";
import {
	LENS_ACTIONS,
	lensBoardSpec,
} from "@/pages/graphs-detail/features/govern/dashboards/lensBoardSpec";
import { DASHBOARD_ICONS } from "@/pages/graphs-detail/shared/dashboardIcons";
import { VIEW_DASHBOARD } from "@/pages/graphs-detail/shared/dashboardSpec";
import type { LensKind } from "@/types/govern";
import { Dashboard } from "@invana/dashboard";
import { EmptyState, Spinner } from "@invana/ui";
import { useMemo, useState } from "react";

export interface LensBoardPageProps {
	username: string;
	graphSlug: string;
	/** Which of the two names this page is under — it changes what it says. */
	kind: LensKind;
	/** The `lenses.id` every panel binds to. */
	lensId: string;
	/** `Edit` — puts the Govern drawer back on this lens, drilled in. */
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
	const lenses = useLensesQuery(username, graphSlug);
	const [view, setView] = useState(VIEW_DASHBOARD);

	const lens = detail.data ?? null;
	// A world is edited by anyone who can reach the Graph; a guardrail is the
	// product's one field-level permission (GV22), and without it the control
	// is absent rather than greyed (GR12).
	const mayEdit =
		lens?.kind === "guardrail"
			? (lenses.data?.may_edit_guardrails ?? false)
			: true;

	const spec = useMemo(
		() => (lens ? lensBoardSpec(lens, { view, mayEdit }) : null),
		[lens, view, mayEdit],
	);

	// `Save report` on the header, and the act behind it (B6). What it keeps is
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
		<Dashboard
			className="h-full min-h-0"
			spec={report.spec}
			icons={DASHBOARD_ICONS}
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
