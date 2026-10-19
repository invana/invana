/**
 * A dataset's **Overview** — what it is at a glance (board `datasets.dataset`):
 * tiles for records, origin, conformance, licence and version; a preview of
 * the current version's first rows; and where it came from, as its author
 * chain. When a version is retracted the page opens with the notice and what
 * it flags downstream (board `datasets.dataset.retracted`).
 */

import {
	Alert,
	AlertDescription,
	Button,
	EmptyState,
	MetricGrid,
	MetricTile,
	PropertyList,
	PropertyRow,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { Table2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cell, dayLabel, ORIGIN_LABEL, percent, ROLE_LABEL } from "../labels";
import { PageBody } from "../parts";
import {
	useDatasetStandardsQuery,
	useRecordsQuery,
	useVersionsQuery,
} from "../queries";
import { datasetPath, useDatasetOutlet } from "./context";
import { Downstream } from "./Downstream";

const PREVIEW = 6;

export function OverviewTab() {
	const { dataset, ref } = useDatasetOutlet();
	const navigate = useNavigate();
	const version = dataset.current_version;
	const records = useRecordsQuery(ref, version, 0, PREVIEW);
	const versions = useVersionsQuery(ref);
	const standards = useDatasetStandardsQuery(ref);
	const current = versions.data?.items.find((v) => v.version === version);
	const retracted = (versions.data?.items ?? []).filter((v) => v.retracted);
	const columns = current?.columns ?? [];
	const lowest = standards.data?.lowest_score ?? null;
	const claimed = standards.data?.total ?? 0;

	return (
		<PageBody>
			{retracted.map((v) => (
				<div key={v.id} className="flex flex-col gap-2">
					<Alert tone="destructive">
						<AlertDescription>
							<strong>{v.address}</strong> was retracted on{" "}
							{dayLabel(v.retracted?.at ?? v.published_at)}
							{v.retracted?.reason ? ` — reason: ${v.retracted.reason}` : ""}.
							It stays readable for audit; nothing new can bind or derive from
							it.
						</AlertDescription>
					</Alert>
					<Downstream address={v.address} versions={[v.version]} />
				</div>
			))}

			<MetricGrid minTileWidth={160}>
				<MetricTile
					label="Records"
					value={dataset.record_count.toLocaleString()}
					caption={`keyed by ${dataset.key_column}`}
				/>
				<MetricTile
					label="Origin"
					value={ORIGIN_LABEL[dataset.origin]}
					caption={current?.source ?? "set once, inherited by its records"}
				/>
				<MetricTile
					label="Conformance"
					value={lowest === null ? "—" : percent(lowest)}
					tone={lowest !== null && lowest < 1 ? "warning" : undefined}
					caption={
						claimed
							? `${claimed} standard${claimed === 1 ? "" : "s"} claimed`
							: "no standard claimed"
					}
				/>
				<MetricTile
					label="Licence"
					value={dataset.licence ?? "—"}
					caption={`cite ${dataset.publisher}`}
				/>
				<MetricTile
					label="Version"
					value={version === null ? "—" : `v${version}`}
					caption={
						current
							? `${dayLabel(current.published_at)} · immutable`
							: "no import yet"
					}
				/>
			</MetricGrid>

			<div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
				<PanelSection
					card
					title="Preview"
					action={
						records.data ? (
							<span className="text-sm text-muted-foreground">
								{records.data.items.length} of {records.data.total} rows
							</span>
						) : null
					}
				>
					{version === null ? (
						<EmptyState
							icon={<Table2 className="size-6" />}
							title="No version yet"
							description="The first import is v1. Run invana datasets import, or add observations."
						/>
					) : records.isLoading ? (
						<Spinner />
					) : (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									{columns.map((c) => (
										<TableHead key={c}>{c}</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{(records.data?.items ?? []).map((r) => (
									<TableRow
										key={r.key}
										className="cursor-pointer"
										onClick={() =>
											navigate(
												datasetPath(
													ref,
													`records/${encodeURIComponent(r.key)}`,
												),
											)
										}
									>
										{columns.map((c) => (
											<TableCell key={c} className="font-mono">
												{cell(r.values[c])}
											</TableCell>
										))}
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</PanelSection>

				<PanelSection card title="Where it came from">
					<PropertyList labelWidth={110}>
						<PropertyRow label="origin">
							{ORIGIN_LABEL[dataset.origin]}
						</PropertyRow>
						{dataset.author_chain.map((step, i) => (
							<PropertyRow
								// biome-ignore lint/suspicious/noArrayIndexKey: the chain is ordered and never reordered
								key={i}
								label={ROLE_LABEL[step.role]}
								mono
							>
								{[step.name, step.result].filter(Boolean).join(" · ")}
							</PropertyRow>
						))}
						{dataset.author_chain.length === 0 ? (
							<PropertyRow label="author">{dataset.publisher}</PropertyRow>
						) : null}
					</PropertyList>
					<Button
						variant="outline"
						size="sm"
						className="mt-2"
						onClick={() => navigate(datasetPath(ref, "provenance"))}
					>
						Full provenance
					</Button>
				</PanelSection>
			</div>
		</PageBody>
	);
}
