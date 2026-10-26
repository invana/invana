/**
 * The Modeller's footer (modeller.md › The Modeller's status bar): on the
 * left the model with a draft — `<model> · vN active · vM draft · N staged` —
 * and whether it validates, then `N types across M models` on the right.
 * Without a draft, the left is the models count alone.
 *
 * The shell's `footer` takes its two sides separately, so one component draws
 * either. Which model has a draft is on the models list itself.
 */

import { StatusCount } from "@invana-studio/ui";
import {
	useGlobalModelQuery,
	useModelsQuery,
	useStagedSetQuery,
} from "../queries";

export interface ModellerStatusBarProps {
	username: string;
	graphSlug: string;
	side: "left" | "right";
}

const version = (label: string | null | undefined) =>
	label ? `v${label}` : null;

export function ModellerStatusBar({
	username,
	graphSlug,
	side,
}: ModellerStatusBarProps) {
	const models = useModelsQuery(username, graphSlug);
	const union = useGlobalModelQuery(username, graphSlug);
	const authored = (models.data ?? []).filter(
		(m) => m.origin !== "introspected",
	);

	const drafted = authored.find((m) => m.draft_version);
	const staged = useStagedSetQuery(username, graphSlug, drafted?.id, !!drafted);

	if (side === "right") {
		if (!union.data) return null;
		const types = union.data.node_types.length + union.data.edge_types.length;
		return (
			<span className="px-2">
				{types} {types === 1 ? "type" : "types"} across {union.data.model_count}{" "}
				{union.data.model_count === 1 ? "model" : "models"}
			</span>
		);
	}

	if (!drafted) {
		if (!models.data) return null;
		return (
			<span className="px-2">
				{authored.length} {authored.length === 1 ? "model" : "models"}
			</span>
		);
	}

	const draftLabel = version(drafted.draft_version?.version);
	const parts = [
		drafted.name,
		version(drafted.active_version?.version)
			? `${version(drafted.active_version?.version)} active`
			: "not published",
		draftLabel ? `${draftLabel} draft` : "draft",
		staged.data ? `${staged.data.count} staged` : null,
	].filter(Boolean);

	return (
		<span className="flex items-center gap-3 px-2">
			<span>{parts.join(" · ")}</span>
			{staged.data ? (
				<StatusCount tone={staged.data.can_commit ? "success" : "warning"}>
					{staged.data.can_commit ? "valid" : (staged.data.reason ?? "invalid")}
				</StatusCount>
			) : null}
		</span>
	);
}
