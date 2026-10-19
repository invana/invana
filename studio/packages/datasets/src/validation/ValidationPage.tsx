/**
 * **Validation** — the queue at `/datasets/validation` (datasets.md DS-07,
 * board `datasets.validation`): each record of a current version that breaks a
 * standard its dataset claims, waiting for a person to decide.
 *
 * `?dataset=<publisher/name>` narrows it to one dataset — the conformance
 * tab's *Review* lands here that way. Every count to review is the engine's;
 * a claim lists at most 50 of its violations, so the rows can be fewer.
 *
 * An item opens its page, where the dataset's publisher fixes the value. An
 * item leaves the queue when the next version conforms; there is no separate
 * *reviewed* record.
 */

import {
	Badge,
	EmptyState,
	FilterBar,
	MultiFilterChip,
	RecordHeader,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { parseAddress } from "../api";
import { cell } from "../labels";
import { Page, PageBody } from "../parts";
import { useValidationQueue } from "../queries";
import { itemPath, KIND_LABEL } from "./queue";

export function ValidationPage() {
	const navigate = useNavigate();
	const [params, setParams] = useSearchParams();
	const only = params.get("dataset");
	const queue = useValidationQueue();
	const all = queue.data?.items ?? [];
	const datasets = queue.data?.datasets ?? [];
	const total = queue.data?.total ?? 0;
	const unreadable = queue.data?.unreadable ?? 0;
	const items = only ? all.filter((i) => i.dataset === only) : all;
	const toReview = only
		? (datasets.find((d) => d.address === only)?.total ?? 0)
		: total;
	const titleOf = new Map(datasets.map((d) => [d.address, d.title || d.name]));

	return (
		<Page>
			<RecordHeader
				size="lg"
				crumbs={["Validation"]}
				chips={
					<Badge variant="outline" tone={total ? "warning" : "muted"} size="xs">
						{total} to review
					</Badge>
				}
			/>
			<PageBody>
				<p className="text-sm text-muted-foreground">
					Standard violations on each dataset's current version · conflicts with
					official data need a validator agent, which this install does not run
				</p>
				<FilterBar
					className="rounded-sm border"
					summary={
						unreadable
							? `${items.length} shown · ${unreadable} datasets could not be read`
							: `${items.length} shown`
					}
				>
					<MultiFilterChip
						label="Dataset"
						multiple={false}
						options={datasets.map((d) => d.address)}
						value={only ? [only] : []}
						onChange={(next) =>
							setParams(next[0] ? { dataset: next[0] } : {}, { replace: true })
						}
					/>
				</FilterBar>
				<PanelSection
					card
					title="To review"
					action={
						<span className="text-sm text-muted-foreground">{toReview}</span>
					}
				>
					{queue.isLoading ? (
						<Spinner />
					) : !items.length ? (
						<EmptyState
							icon={<ShieldCheck className="size-6" />}
							title="Nothing to review"
							description="Every record conforms to the standards its dataset claims. Attach a standard to a dataset to score it."
						/>
					) : (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Record</TableHead>
									<TableHead className="w-full">What breaks</TableHead>
									<TableHead>Dataset</TableHead>
									<TableHead>Kind</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{items.map(
									({ dataset, standard, mode, violation: v, column }) => (
										<TableRow
											key={`${dataset}/${standard}/${v.key}/${v.term}`}
											className="cursor-pointer"
											onClick={() =>
												navigate(itemPath(parseAddress(dataset), v.key, v.term))
											}
										>
											<TableCell className="whitespace-nowrap font-medium">
												{v.key} · {column}
											</TableCell>
											<TableCell className="max-w-0 truncate">
												{`${cell(v.value)} · ${KIND_LABEL[v.kind]} · ${parseAddress(standard).name} (${mode})`}
											</TableCell>
											<TableCell className="whitespace-nowrap">
												{titleOf.get(dataset) ?? dataset}
											</TableCell>
											<TableCell>
												<Badge variant="outline" tone="warning" size="xs">
													standard
												</Badge>
											</TableCell>
										</TableRow>
									),
								)}
							</TableBody>
						</Table>
					)}
				</PanelSection>
			</PageBody>
		</Page>
	);
}
