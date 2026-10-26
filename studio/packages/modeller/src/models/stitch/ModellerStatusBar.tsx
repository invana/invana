/**
 * The Modeller's footer (modeller.md › The Modeller's status bar): on the
 * left the model with a draft — `<model> · vN active · vM draft · N staged` —
 * and whether it validates, then `N types across M models` on the right.
 * Without a draft, the left is the models count alone.
 *
 * The shell's `footer` takes its two sides separately, so one component draws
 * either. Which models have a draft is read the way the compare bar reads it —
 * a draft review per model, where no draft answers 404 — so both share a cache.
 */

import { StatusCount } from "@invana-studio/ui";
import { useQueries } from "@tanstack/react-query";
import { modelsApi } from "../api";
import {
	useGlobalModelQuery,
	useModelQuery,
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

	const reviews = useQueries({
		queries: authored.map((m) => ({
			queryKey: ["models", username, graphSlug, m.id, "draft-review"],
			queryFn: () => modelsApi.draftReview(username, graphSlug, m.id),
			retry: false,
		})),
	});
	const drafted = authored.find((_, i) => reviews[i]?.data);
	const detail = useModelQuery(username, graphSlug, drafted?.id);
	const staged = useStagedSetQuery(username, graphSlug, drafted?.id, !!drafted);

	if (side === "right") {
		if (!union.data) return null;
		const types = union.data.node_types.length + union.data.edge_types.length;
		return (
			<span>
				{types} {types === 1 ? "type" : "types"} across {union.data.model_count}{" "}
				{union.data.model_count === 1 ? "model" : "models"}
			</span>
		);
	}

	if (!drafted) {
		if (!models.data) return null;
		return (
			<span>
				{authored.length} {authored.length === 1 ? "model" : "models"}
			</span>
		);
	}

	const draftLabel = version(
		detail.data?.versions.find((v) => v.status === "draft")?.version,
	);
	const parts = [
		drafted.name,
		version(drafted.active_version?.version)
			? `${version(drafted.active_version?.version)} active`
			: "not published",
		draftLabel ? `${draftLabel} draft` : "draft",
		staged.data ? `${staged.data.count} staged` : null,
	].filter(Boolean);

	return (
		<span className="flex items-center gap-3">
			<span>{parts.join(" · ")}</span>
			{staged.data ? (
				<StatusCount tone={staged.data.can_commit ? "success" : "warning"}>
					{staged.data.can_commit ? "valid" : (staged.data.reason ?? "invalid")}
				</StatusCount>
			) : null}
		</span>
	);
}
