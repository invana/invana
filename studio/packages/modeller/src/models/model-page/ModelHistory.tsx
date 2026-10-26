/**
 * The model page's History tab — board `modeller.model.history`.
 *
 * Every published version of the model in scope, newest first: version ·
 * when · by · what changed · why · effect after, from the shared change log
 * (`history/model/<id>`). With All models in scope it lists every model's
 * versions together, with a Model column. A row's *Compare* opens the shell's
 * compare page against the version before it.
 *
 * Effect after is what the publish did to the datasets bound to the types
 * it changed, stored at publish. A version that touched none keeps the
 * Graph's runs while it was the published one — said so in the column, so
 * nobody reads it as attribution.
 */

import {
	Button,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import {
	type ChangeEntry,
	comparePath,
	effectLine,
	useRecordHistories,
} from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { useNavigate } from "react-router-dom";
import type { GraphModelSummary } from "../types";

interface Row {
	model: GraphModelSummary;
	entry: ChangeEntry;
	before: string | null;
}

const day = (iso: string | null) =>
	iso
		? new Date(iso).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			})
		: "—";

const plural = (n: number, one: string, many: string) =>
	`${n} ${n === 1 ? one : many}`;

/** What the publish did to bound datasets, as the engine stored it. */
const effect = (e: ChangeEntry) => {
	const { datasets = [], datasets_failing = 0, rows_failing = 0 } = e.effect;
	if (datasets.length > 0) {
		return datasets_failing > 0
			? `${plural(datasets_failing, "dataset now warns", "datasets now warn")} · ${plural(rows_failing, "row", "rows")}`
			: `${plural(datasets.length, "dataset holds", "datasets hold")}`;
	}
	return e.effect.runs === 0
		? effectLine(e.effect)
		: `${effectLine(e.effect)} while published`;
};

export function ModelHistory({
	username,
	graphSlug,
	models,
	all,
}: {
	username: string;
	graphSlug: string;
	/** The model in scope, or every authored model. */
	models: GraphModelSummary[];
	/** All models is in scope — the Model column shows. */
	all: boolean;
}) {
	const graph = { username, graphSlug };
	const navigate = useNavigate();
	const histories = useRecordHistories(
		graph,
		models.map((m) => ({ kind: "model" as const, id: m.id })),
	);
	if (histories.some((h) => h.isLoading)) return <Spinner />;

	const rows: Row[] = histories
		.flatMap((h, i) => {
			const model = models[i];
			if (!model || !h.data) return [];
			const items = h.data.items;
			return items.map((entry, at) => ({
				model,
				entry,
				before: items[at + 1]?.version ?? null,
			}));
		})
		.sort((a, b) => (b.entry.at ?? "").localeCompare(a.entry.at ?? ""));

	return (
		<PanelSection card title="Versions" hint={`${rows.length}`}>
			{rows.length === 0 ? (
				<p className="text-muted-foreground">
					Nothing is published yet — a version lands here when a draft is
					published.
				</p>
			) : (
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							{all ? <TableHead>Model</TableHead> : null}
							<TableHead>Version</TableHead>
							<TableHead>When</TableHead>
							<TableHead>By</TableHead>
							<TableHead className="w-1/2 min-w-48">What changed</TableHead>
							<TableHead className="w-1/3">Why</TableHead>
							<TableHead>Effect after</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map(({ model, entry, before }) => (
							<TableRow key={`${model.id}-${entry.version}`}>
								{all ? (
									<TableCell className="whitespace-nowrap">
										{model.name}
									</TableCell>
								) : null}
								<TableCell className="font-mono">v{entry.version}</TableCell>
								<TableCell className="whitespace-nowrap">
									{day(entry.at)}
								</TableCell>
								<TableCell className="whitespace-nowrap">
									{entry.actor_name ?? entry.actor_kind ?? "—"}
								</TableCell>
								<TableCell>{entry.summary}</TableCell>
								<TableCell>{entry.why ?? "—"}</TableCell>
								<TableCell className="whitespace-nowrap">
									{effect(entry)}
								</TableCell>
								<TableCell>
									{before ? (
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												navigate(
													comparePath(graph, "model", model.id, {
														a: before,
														b: entry.version,
													}),
												)
											}
										>
											Compare
										</Button>
									) : null}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</PanelSection>
	);
}
