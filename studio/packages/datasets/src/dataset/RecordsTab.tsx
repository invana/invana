/**
 * A dataset's **Records** — the current version's rows, paged by key — and
 * one **record** with its change log (board `datasets.record`, DS-04).
 *
 * A record shows its values, its provenance exception where it has one, and
 * every version that changed it: property, before → after, when and why. The
 * log is read from the versions, so a fix is never silent.
 */

import {
	Badge,
	Button,
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
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cell, dayLabel } from "../labels";
import { PageBody, ReadState } from "../parts";
import {
	useRecordHistoryQuery,
	useRecordQuery,
	useRecordsQuery,
	useVersionsQuery,
} from "../queries";
import type { PropertyChange } from "../types";
import { datasetPath, useDatasetOutlet } from "./context";

const PAGE = 50;

export function RecordsTab() {
	const { dataset, ref } = useDatasetOutlet();
	const navigate = useNavigate();
	const [offset, setOffset] = useState(0);
	const version = dataset.current_version;
	const versions = useVersionsQuery(ref);
	const columns =
		versions.data?.items.find((v) => v.version === version)?.columns ?? [];
	const page = useRecordsQuery(ref, version, offset, PAGE);
	const total = page.data?.total ?? 0;

	return (
		<PageBody>
			<PanelSection
				card
				title={version === null ? "Records" : `Records · v${version}`}
				action={
					<span className="flex items-center gap-2 text-sm text-muted-foreground">
						{total
							? `${offset + 1}–${Math.min(offset + PAGE, total)} of ${total.toLocaleString()}`
							: "no records"}
						<Button
							variant="outline"
							size="xs"
							disabled={offset === 0}
							onClick={() => setOffset(Math.max(0, offset - PAGE))}
						>
							Previous
						</Button>
						<Button
							variant="outline"
							size="xs"
							disabled={offset + PAGE >= total}
							onClick={() => setOffset(offset + PAGE)}
						>
							Next
						</Button>
					</span>
				}
			>
				{page.isLoading ? (
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
							{(page.data?.items ?? []).map((r) => (
								<TableRow
									key={r.key}
									className="cursor-pointer"
									onClick={() =>
										navigate(
											datasetPath(ref, `records/${encodeURIComponent(r.key)}`),
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
		</PageBody>
	);
}

function change(p: PropertyChange): string {
	return `${p.property} ${cell(p.before)} → ${cell(p.after)}`;
}

export function RecordPage() {
	const { dataset, ref } = useDatasetOutlet();
	const { key = "" } = useParams();
	const record = useRecordQuery(ref, key);
	const history = useRecordHistoryQuery(ref, key);

	if (!record.data) {
		return <ReadState loading={record.isLoading} error={record.error} />;
	}
	const items = history.data?.items ?? [];

	return (
		<PageBody>
			<div className="grid gap-3 lg:grid-cols-2">
				<PanelSection
					card
					title={key}
					action={
						<span className="text-sm text-muted-foreground">
							v{record.data.version} · of{" "}
							{dataset.record_count.toLocaleString()}
						</span>
					}
				>
					<PropertyList labelWidth={130}>
						{Object.entries(record.data.values).map(([k, v]) => (
							<PropertyRow key={k} label={k} mono>
								{cell(v)}
							</PropertyRow>
						))}
						{record.data.provenance ? (
							<PropertyRow label="provenance">
								<Badge variant="outline" tone="info" size="xs">
									{Object.values(record.data.provenance)
										.map(String)
										.join(" · ")}
								</Badge>
							</PropertyRow>
						) : null}
					</PropertyList>
				</PanelSection>

				<PanelSection
					card
					title="Change log"
					action={
						<span className="text-sm text-muted-foreground">
							{items.length} change{items.length === 1 ? "" : "s"} · properties
							named
						</span>
					}
				>
					{history.isLoading ? (
						<Spinner />
					) : (
						<Table bordered={false} density="compact">
							<TableBody>
								{items.map((c) => (
									<TableRow key={c.version}>
										<TableCell className="whitespace-nowrap">
											{dayLabel(c.at)}
										</TableCell>
										<TableCell className="font-mono">v{c.version}</TableCell>
										<TableCell className="font-mono">
											{c.kind === "changed"
												? c.properties.map(change).join(" · ")
												: c.kind}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{c.why ?? "—"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</PanelSection>
			</div>
		</PageBody>
	);
}
