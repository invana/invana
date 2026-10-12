/**
 * A dataset's **Provenance** (board `datasets.dataset.provenance`): the author
 * chain of its current version, oldest step first, ending at the version
 * itself; the licence and how to cite it; and the records whose origin differs
 * from the dataset's — the only place record-level provenance is stored.
 *
 * Every step is the one recorded on the version, never inferred. An observed
 * dataset with an empty chain was authored by whoever imported it.
 */

import {
	PropertyList,
	PropertyRow,
	Spinner,
	TimelineEntry,
	TimelineList,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { useNavigate } from "react-router-dom";
import { dayLabel, ROLE_LABEL, shortHash } from "../labels";
import { PageBody } from "../parts";
import { useRecordsQuery, useVersionsQuery } from "../queries";
import { datasetPath, useDatasetOutlet } from "./context";

const SCAN = 1000;

export function ProvenanceTab() {
	const { dataset, ref } = useDatasetOutlet();
	const navigate = useNavigate();
	const versions = useVersionsQuery(ref);
	const version = dataset.current_version;
	const current = versions.data?.items.find((v) => v.version === version);
	const records = useRecordsQuery(ref, version, 0, SCAN);
	const exceptions = (records.data?.items ?? []).filter((r) => r.provenance);
	const year = current ? new Date(current.published_at).getFullYear() : null;

	return (
		<PageBody>
			<PanelSection
				card
				title="Author chain"
				action={
					<span className="text-sm text-muted-foreground">
						oldest first · each step is recorded, never inferred
					</span>
				}
			>
				<TimelineList variant="rail">
					{(current?.author_chain ?? dataset.author_chain).map((step, i) => (
						<TimelineEntry
							// biome-ignore lint/suspicious/noArrayIndexKey: the chain is ordered and never reordered
							key={i}
							when={ROLE_LABEL[step.role]}
							title={step.name}
						>
							{[step.kind, step.ref, step.result].filter(Boolean).join(" · ")}
						</TimelineEntry>
					))}
					{current ? (
						<TimelineEntry when="this version" title={`v${current.version}`}>
							{`${shortHash(current.content_hash)} · ${dayLabel(current.published_at)}`}
						</TimelineEntry>
					) : null}
				</TimelineList>
			</PanelSection>

			<div className="grid gap-3 lg:grid-cols-2">
				<PanelSection card title="Licence and citation">
					<PropertyList labelWidth={90}>
						<PropertyRow label="licence" mono>
							{dataset.licence ?? "—"}
						</PropertyRow>
						<PropertyRow label="cite as" mono>
							{current
								? `${dataset.publisher} (${year}). ${dataset.title || dataset.name}, v${current.version}.`
								: "—"}
						</PropertyRow>
						<PropertyRow label="source" mono>
							{current?.source ?? "—"}
						</PropertyRow>
						{current?.derived_from.length ? (
							<PropertyRow label="derived from" mono>
								{current.derived_from.join(" · ")}
							</PropertyRow>
						) : null}
					</PropertyList>
				</PanelSection>

				<PanelSection
					card
					title="Record-level exceptions"
					action={
						<span className="text-sm text-muted-foreground">
							{records.data && records.data.total > SCAN
								? `${exceptions.length} in the first ${SCAN.toLocaleString()} records`
								: `${exceptions.length} record${exceptions.length === 1 ? "" : "s"} differ from the dataset`}
						</span>
					}
				>
					{records.isLoading ? (
						<Spinner />
					) : exceptions.length ? (
						<PropertyList labelWidth={110}>
							{exceptions.map((r) => (
								<PropertyRow
									key={r.key}
									label={r.key}
									mono
									className="cursor-pointer"
									onClick={() =>
										navigate(
											datasetPath(ref, `records/${encodeURIComponent(r.key)}`),
										)
									}
								>
									{Object.entries(r.provenance ?? {})
										.map(([k, v]) => `${k} ${String(v)}`)
										.join(" · ")}
								</PropertyRow>
							))}
						</PropertyList>
					) : (
						<p className="text-sm text-muted-foreground">
							Every record inherits the dataset's origin.
						</p>
					)}
				</PanelSection>
			</div>
		</PageBody>
	);
}
