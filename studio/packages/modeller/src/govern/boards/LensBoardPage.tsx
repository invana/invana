/**
 * The world board, as a page — `/modeller/worlds/<id>`, opened as a workbook
 * tab titled with the world's name.
 *
 * The board reads; the acts stay in the Worlds panel. Its one act, *Edit*,
 * puts the Govern panel back on this world, in its editor — editing is the
 * `model` role's, so without it *Edit* shows disabled rather than going
 * missing.
 *
 * The detail read carries what the board shows: `allow_rules` · `deny_rules`,
 * the usage (`runs`, `runs_30d`, `last_used_at`, and `by_agent` — the cast of
 * agents whose runs asked under the world) and the cast resolved against the
 * guardrails, which only the server can compose. The composer is
 * {@link lensBoardSpec}.
 */

import { Board } from "@invana/boards";
import { EmptyState, Spinner } from "@invana/ui";
import { useAccess } from "@invana-studio/shell";
import { BOARD_ICONS } from "@invana-studio/ui";
import { useMemo } from "react";
import { useLensQuery } from "../queries";
import { LENS_ACTIONS, lensBoardSpec } from "./lensBoardSpec";

export interface LensBoardPageProps {
	username: string;
	graphSlug: string;
	/** The world's `lenses.id` every panel binds to. */
	lensId: string;
	/** `Edit` — puts the Govern panel back on this world, in its editor. */
	onEdit: (lensId: string) => void;
}

export function LensBoardPage({
	username,
	graphSlug,
	lensId,
	onEdit,
}: LensBoardPageProps) {
	const detail = useLensQuery(username, graphSlug, lensId);
	const mayEdit = useAccess().gate("model").allowed;
	const lens = detail.data ?? null;

	const spec = useMemo(
		() =>
			lens && lens.kind === "world"
				? lensBoardSpec(lens, { mayEdit, graphName: graphSlug })
				: null,
		[lens, mayEdit, graphSlug],
	);

	if (detail.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	if (!spec) {
		return (
			<EmptyState
				className="h-full"
				title="This world is gone"
				description="It was deleted, or it belongs to a Graph this account can no longer read. Every run is still inside the Graph's guardrails."
			/>
		);
	}

	return (
		<Board
			className="h-full min-h-0"
			spec={spec}
			icons={BOARD_ICONS}
			onAction={(id) => {
				if (id === LENS_ACTIONS.edit) onEdit(lensId);
			}}
		/>
	);
}
