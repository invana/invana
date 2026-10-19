/**
 * **Catalogue** — every dataset the person can read, install-wide, at
 * `/datasets/catalogue` (datasets.md DS-01, board `datasets.catalogue`).
 *
 * The filter bar narrows by origin, publisher and the Graph that binds a
 * dataset on the server (`origin` · `publisher` · `bound_in` · `q`), and by
 * standard and licence here, over what the server returned — a dataset's
 * standards come from the engine's install-wide claims (`useClaimsQuery`).
 * Under it, the origin legend: what each origin means, once.
 *
 * A row opens the dataset's page. *Collect with an agent* is drawn and
 * disabled: the install has no collector agent to run. A dataset is created by
 * `invana datasets import`, so the empty state shows that command.
 */

import {
	Badge,
	ButtonWithTooltip,
	EmptyState,
	FilterBar,
	MultiFilterChip,
	RecordHeader,
	SearchInput,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Terminal,
	TerminalLine,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { Bot, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseAddress } from "../api";
import { datasetPath } from "../dataset/context";
import { ORIGIN_LABEL, ORIGINS, percent } from "../labels";
import { OriginBadge, Page, PageBody } from "../parts";
import { useBindTargets, useCatalogueQuery, useClaimsQuery } from "../queries";
import type { DatasetClaim as Claim, Dataset } from "../types";

const IMPORT_COMMAND =
	"invana datasets import --path <file.csv> --as <publisher>/<name> --origin official --licence <licence>";

const ORIGIN_MEANS =
	"where the data came from — set once per dataset, inherited by its records";

/** `crop/co_338@2` → `co_338`, short enough for a cell. */
function standardName(address: string): string {
	return parseAddress(address).name;
}

function StandardsCell({ claims }: { claims: Claim[] }) {
	if (!claims.length) return <span className="text-muted-foreground">—</span>;
	return (
		<span className="flex flex-wrap gap-1">
			{claims.map(({ attachment: a }) => {
				const c = a.conformance;
				const name = standardName(a.standard);
				return (
					<Badge
						key={a.standard}
						variant="outline"
						size="xs"
						className="whitespace-nowrap"
						tone={!c ? "muted" : c.conforms ? "success" : "warning"}
					>
						{!c || c.conforms ? `✓ ${name}` : `◐ ${name} · ${percent(c.score)}`}
					</Badge>
				);
			})}
		</span>
	);
}

function one(values: string[]): string | undefined {
	return values[0];
}

export function CataloguePage() {
	const navigate = useNavigate();
	const [origin, setOrigin] = useState<string[]>([]);
	const [publisher, setPublisher] = useState<string[]>([]);
	const [boundIn, setBoundIn] = useState<string[]>([]);
	const [standard, setStandard] = useState<string[]>([]);
	const [licence, setLicence] = useState<string[]>([]);
	const [q, setQ] = useState("");

	// The unfiltered catalogue names the choices; the filtered one is the table.
	const everything = useCatalogueQuery();
	const filtered = useCatalogueQuery({
		origin: one(origin),
		publisher: one(publisher),
		boundIn: one(boundIn),
		q: q.trim() || undefined,
	});
	const claimsQuery = useClaimsQuery();
	const claims = useMemo(
		() => claimsQuery.data?.items ?? [],
		[claimsQuery.data],
	);
	const graphs = useBindTargets();

	const all = everything.data?.items ?? [];
	const claimsOf = useMemo(() => {
		const by = new Map<string, Claim[]>();
		for (const c of claims) {
			by.set(c.dataset.id, [...(by.get(c.dataset.id) ?? []), c]);
		}
		return by;
	}, [claims]);

	const rows = (filtered.data?.items ?? []).filter(
		(d: Dataset) =>
			(!standard.length ||
				(claimsOf.get(d.id) ?? []).some((c) =>
					standard.includes(standardName(c.attachment.standard)),
				)) &&
			(!licence.length || licence.includes(d.licence ?? "")),
	);

	const publishers = [...new Set(all.map((d) => d.publisher))].sort();
	const licences = [
		...new Set(all.map((d) => d.licence).filter((l): l is string => !!l)),
	].sort();
	const standards = [
		...new Set(claims.map((c) => standardName(c.attachment.standard))),
	].sort();
	const origins = new Set(all.map((d) => d.origin));

	return (
		<Page>
			<RecordHeader
				size="lg"
				crumbs={["Catalogue"]}
				chips={
					<>
						<Badge variant="outline" tone="muted" size="xs">
							{all.length} dataset{all.length === 1 ? "" : "s"}
						</Badge>
						<Badge variant="outline" tone="muted" size="xs">
							{origins.size} origin{origins.size === 1 ? "" : "s"}
						</Badge>
					</>
				}
				actions={
					<ButtonWithTooltip
						variant="outline"
						size="sm"
						disabled
						tooltip="This install has no collector agent to run."
					>
						<Bot />
						Collect with an agent
					</ButtonWithTooltip>
				}
			/>
			<PageBody>
				<p className="text-sm text-muted-foreground">
					Reusable knowledge one lab publishes and others reuse · install-wide,
					above Graphs
				</p>
				<FilterBar
					className="rounded-sm border"
					summary={`${rows.length} shown`}
				>
					<MultiFilterChip
						label="Origin"
						multiple={false}
						options={ORIGINS.map((o) => ({
							value: o,
							label: ORIGIN_LABEL[o],
						}))}
						value={origin}
						onChange={setOrigin}
					/>
					<MultiFilterChip
						label="Standard"
						options={standards}
						value={standard}
						onChange={setStandard}
					/>
					<MultiFilterChip
						label="Licence"
						options={licences}
						value={licence}
						onChange={setLicence}
					/>
					<MultiFilterChip
						label="Published by"
						multiple={false}
						options={publishers}
						value={publisher}
						onChange={setPublisher}
					/>
					<MultiFilterChip
						label="Bound in"
						multiple={false}
						options={(graphs.data?.items ?? []).map((g) => ({
							value: `${g.owner_username}/${g.slug}`,
							label: g.name,
						}))}
						value={boundIn}
						onChange={setBoundIn}
					/>
				</FilterBar>
				<SearchInput
					inputSize="sm"
					value={q}
					onChange={setQ}
					placeholder="Search datasets…"
					className="w-full"
				/>
				<div className="flex flex-wrap items-center gap-1.5">
					{ORIGINS.map((o) => (
						<OriginBadge key={o} origin={o} />
					))}
					<span className="text-sm text-muted-foreground">{ORIGIN_MEANS}</span>
				</div>

				<PanelSection
					card
					title="Datasets"
					action={
						<span className="text-sm text-muted-foreground">{rows.length}</span>
					}
				>
					{filtered.isLoading ? (
						<Spinner />
					) : !all.length ? (
						<EmptyState
							icon={<Table2 className="size-6" />}
							title="No datasets yet"
							description="A dataset is published from a file with the CLI; every version after that is minted the same way, or by adding observations here."
							actions={
								<Terminal>
									<TerminalLine kind="prompt">{IMPORT_COMMAND}</TerminalLine>
								</Terminal>
							}
						/>
					) : !rows.length ? (
						<EmptyState
							title="No dataset matches these filters"
							description="Clear a filter or the search to widen the list."
						/>
					) : (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Dataset</TableHead>
									<TableHead>Origin</TableHead>
									<TableHead className="whitespace-nowrap">
										Published by
									</TableHead>
									<TableHead>Version</TableHead>
									<TableHead className="text-right">Records</TableHead>
									<TableHead>Standards</TableHead>
									<TableHead>Sensitivity</TableHead>
									<TableHead>Visibility</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((d) => (
									<TableRow
										key={d.id}
										className="cursor-pointer"
										onClick={() => navigate(datasetPath(d))}
									>
										<TableCell
											className="w-[40%] max-w-0 truncate font-medium"
											title={d.address}
										>
											{d.title || d.name}
										</TableCell>
										<TableCell>
											<OriginBadge origin={d.origin} />
										</TableCell>
										<TableCell className="whitespace-nowrap">
											{d.publisher}
										</TableCell>
										<TableCell className="font-mono">
											{d.current_version === null
												? "—"
												: `v${d.current_version}`}
										</TableCell>
										<TableCell className="text-right font-mono">
											{d.record_count.toLocaleString()}
										</TableCell>
										<TableCell className="whitespace-nowrap">
											<StandardsCell claims={claimsOf.get(d.id) ?? []} />
										</TableCell>
										<TableCell>{d.sensitivity}</TableCell>
										<TableCell className="whitespace-nowrap">
											{d.visibility === "install" ? "shared" : "only me"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</PanelSection>
			</PageBody>
		</Page>
	);
}
