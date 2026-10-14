/**
 * A dataset's **Conformance** (board `datasets.dataset.conformance`, DS-09):
 * each standard it claims — the pinned version, the mode, the current
 * version's score and its violations — and, for whoever can write the
 * dataset, *Attach a standard* and detach.
 *
 * *Review* opens the validation queue on this dataset, where each violation
 * is an item. A newer standard version never moves the claim; the row says one
 * exists.
 */

import {
	Badge,
	Button,
	EmptyState,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { FileCheck2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AttachStandardDialog } from "../AttachStandardDialog";
import { parseAddress } from "../api";
import { percent } from "../labels";
import { PageBody } from "../parts";
import {
	useDatasetStandardsQuery,
	useDetachStandard,
	useStandardsQuery,
} from "../queries";
import type { DatasetStandard } from "../types";
import { useDatasetOutlet } from "./context";

function violationsLine(s: DatasetStandard): string {
	const c = s.conformance;
	if (!c) return "scored with the first version";
	if (!c.violation_count) return "—";
	const first = c.violations
		.slice(0, 2)
		.map((v) => `${v.key} · ${v.term} ${v.kind.replace("_", " ")}`)
		.join(" · ");
	return `${c.violation_count} violation${c.violation_count === 1 ? "" : "s"} · ${first}`;
}

export function ConformanceTab() {
	const { dataset, ref, canWrite } = useDatasetOutlet();
	const navigate = useNavigate();
	const standards = useDatasetStandardsQuery(ref);
	const detach = useDetachStandard(ref);
	const [attaching, setAttaching] = useState(false);
	const items = standards.data?.items ?? [];
	const library = useStandardsQuery();
	// A claim names `publisher/name@v`; show the standard's title, the address
	// while the library loads or when the reader cannot see it.
	const titleOf = (pinned: string) => {
		const { publisher, name } = parseAddress(pinned);
		const address = `${publisher}/${name}`;
		return (
			library.data?.items.find((t) => t.address === address)?.title || address
		);
	};

	return (
		<PageBody>
			<PanelSection
				card
				title="Standards claimed"
				action={
					<span className="text-sm text-muted-foreground">{items.length}</span>
				}
			>
				{standards.isLoading ? (
					<Spinner />
				) : !items.length ? (
					<EmptyState
						icon={<FileCheck2 className="size-6" />}
						title="No standard claimed"
						description="Attach a standard from the library to score every version of this dataset against it — and, in block mode, to refuse a version that breaks it."
					/>
				) : (
					<Table bordered={false} density="compact">
						<TableHeader>
							<TableRow>
								<TableHead>Standard</TableHead>
								<TableHead>Mode</TableHead>
								<TableHead>Conformance</TableHead>
								<TableHead className="w-full">Violations</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((s) => {
								const c = s.conformance;
								return (
									<TableRow key={s.standard}>
										<TableCell
											className="whitespace-nowrap font-medium"
											title={s.standard}
										>
											{titleOf(s.standard)}
											<span className="ml-1 text-sm text-muted-foreground">
												@v{s.version}
											</span>
											{s.newer_version ? (
												<span className="ml-1 text-sm text-muted-foreground">
													· v{s.newer_version} published
												</span>
											) : null}
										</TableCell>
										<TableCell>
											<Badge variant="outline" tone="muted" size="xs">
												{s.mode}
											</Badge>
										</TableCell>
										<TableCell
											className={
												c && !c.conforms ? "text-warning" : "text-success"
											}
										>
											{c
												? `${percent(c.score)} · ${c.conforming} of ${c.record_count}`
												: "—"}
										</TableCell>
										<TableCell className="max-w-0 truncate">
											{violationsLine(s)}
										</TableCell>
										<TableCell className="whitespace-nowrap">
											{c?.violation_count ? (
												<Button
													variant="ghost"
													size="xs"
													onClick={() =>
														navigate(
															`/datasets/validation?dataset=${encodeURIComponent(dataset.address)}`,
														)
													}
												>
													Review
												</Button>
											) : null}
											{canWrite ? (
												<Button
													variant="ghost"
													size="xs"
													disabled={detach.isPending}
													onClick={() =>
														detach.mutate(parseAddress(s.standard))
													}
												>
													Detach
												</Button>
											) : null}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</PanelSection>
			{canWrite ? (
				<Button
					variant="outline"
					size="sm"
					className="self-start"
					onClick={() => setAttaching(true)}
				>
					<FileCheck2 />
					Attach a standard
				</Button>
			) : null}
			{attaching ? (
				<AttachStandardDialog
					open
					dataset={dataset}
					onClose={() => setAttaching(false)}
				/>
			) : null}
		</PageBody>
	);
}
