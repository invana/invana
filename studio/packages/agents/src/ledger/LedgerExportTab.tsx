/**
 * Ledger › Export: the Rows filters as a file, in CSV or JSON Lines, with each
 * row's hash and the previous one's; the past exports; and what the ledger
 * keeps and how it proves it was not edited.
 *
 * The rows are the URL's `f.*` filters — the same ones the Rows tab writes —
 * and the count on the button is the engine's total for them. Zero rows turns
 * *Export* off. The file is fetched signed in and saved by the browser; the
 * engine records the export, and the list reads it again.
 */

import { Field, FieldLabel } from "@invana/forms";
import {
	Button,
	FilterBar,
	PropertyList,
	PropertyRow,
	SegmentedControl,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import {
	apiClient,
	formatShortDateTime,
	useListParams,
} from "@invana-studio/core";
import { FilterSelect, FormError, PanelSection } from "@invana-studio/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { filterValue, ListStrip, setOne } from "../lists";
import { ledgerApi } from "./api";
import { clock, n, SINCE_OPTIONS } from "./ledgerParts";
import {
	useLedgerExportsQuery,
	useLedgerIntegrityQuery,
	useLedgerRowsQuery,
} from "./queries";

type Format = "csv" | "jsonl";

const FORMATS = [
	{ value: "csv", label: "CSV" },
	{ value: "jsonl", label: "JSON Lines" },
];

const VERDICT_OPTIONS = ["allowed", "refused", "approval", "held"].map(
	(value) => ({ value, label: value }),
);

/** Fetches the export signed in and hands it to the browser to save. */
async function download(url: string, format: Format) {
	const res = await apiClient.get<Blob>(url, { responseType: "blob" });
	const named = /filename="?([^";]+)"?/.exec(
		String(res.headers["content-disposition"] ?? ""),
	)?.[1];
	const href = URL.createObjectURL(res.data);
	const a = document.createElement("a");
	a.href = href;
	a.download = named ?? `ledger.${format}`;
	a.click();
	URL.revokeObjectURL(href);
}

export function LedgerExportTab({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const list = useListParams();
	const qc = useQueryClient();
	const [format, setFormat] = useState<Format>("csv");
	const filters = { q: list.query.q, filters: list.query.filters };
	// One row is enough: the page's total is the count the export will hold.
	const matching = useLedgerRowsQuery(username, graphSlug, {
		...filters,
		limit: 1,
	}).data;
	const exports = useLedgerExportsQuery(username, graphSlug);
	const integrity = useLedgerIntegrityQuery(username, graphSlug).data;
	const run = useMutation({
		mutationFn: () =>
			download(
				ledgerApi.exportUrl(username, graphSlug, format, filters),
				format,
			),
		onSettled: () =>
			qc.invalidateQueries({ queryKey: ["ledger", username, graphSlug] }),
	});
	const none = matching?.total === 0;

	return (
		<div className="grid gap-3 lg:grid-cols-2">
			<div className="flex min-w-0 flex-col gap-3">
				<PanelSection card title="Export rows">
					<div className="flex flex-col gap-3 py-1">
						<Field>
							<FieldLabel>Rows</FieldLabel>
							<FilterBar seamless>
								<FilterSelect
									label="When:"
									any="any time"
									value={filterValue(list, "since")}
									options={SINCE_OPTIONS}
									onChange={(v) => setOne(list, "since", v)}
								/>
								<FilterSelect
									label="Verdict:"
									any="any"
									value={filterValue(list, "verdict")}
									options={VERDICT_OPTIONS}
									onChange={(v) => setOne(list, "verdict", v)}
								/>
							</FilterBar>
							<ListStrip page={matching} list={list} />
						</Field>
						<Field>
							<FieldLabel>Format</FieldLabel>
							<SegmentedControl
								size="sm"
								aria-label="Format"
								value={format}
								onValueChange={(v) => setFormat(v as Format)}
								options={FORMATS}
							/>
						</Field>
						<div className="flex items-center justify-end gap-2">
							{none && (
								<span className="text-muted-foreground">no rows match</span>
							)}
							<Button
								size="sm"
								disabled={!matching || none || run.isPending}
								onClick={() => run.mutate()}
							>
								<Download />
								{matching ? `Export ${n(matching.total)} rows` : "Export"}
							</Button>
						</div>
						<FormError error={run.error ? run.error.message : null} />
					</div>
				</PanelSection>
				<PanelSection card title="Exports">
					{!exports.data?.length ? (
						<p className="py-2 text-muted-foreground">No export yet</p>
					) : (
						<Table density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>When</TableHead>
									<TableHead>By</TableHead>
									<TableHead>Rows</TableHead>
									<TableHead>File</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{exports.data.map((e) => (
									<TableRow key={e.id}>
										<TableCell className="whitespace-nowrap">
											{formatShortDateTime(new Date(e.created_at))}
										</TableCell>
										<TableCell>{e.requested_by_name ?? "—"}</TableCell>
										<TableCell className="text-muted-foreground">
											{e.filters_line || "all rows"}
										</TableCell>
										<TableCell className="whitespace-nowrap">
											{e.format} · {n(e.rows)} rows
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</PanelSection>
			</div>
			<PanelSection card title="Retention and integrity">
				<PropertyList labelWidth="auto">
					<PropertyRow label="Kept">
						{integrity ? `${integrity.retention_days} days` : "—"}
					</PropertyRow>
					<PropertyRow label="Edits">none possible — append-only</PropertyRow>
					<PropertyRow label="Hash chain">
						each row hashes the one before; verified every 10 min
						{integrity?.verified_at
							? ` · last ${integrity.ok ? "✓" : "✗"} ${clock(integrity.verified_at)}`
							: ""}
					</PropertyRow>
					<PropertyRow label="Who can read">
						members see rows of runs they can open; admins see all
					</PropertyRow>
				</PropertyList>
			</PanelSection>
		</div>
	);
}
