/**
 * **Standards** — the library at `/datasets/standards` (datasets.md DS-08,
 * board `datasets.standards`): packs the install ships and the ones its labs
 * write, each with how many datasets claim it.
 *
 * The search is the server's (`q`). *Write a standard* opens the dialog and,
 * once v1 is published, the new standard's page. *Import from SKOS* reads a
 * vocabulary, previews it and opens the standard it created or versioned
 * (DS-15, board `datasets.standards.import`). A row opens the standard.
 */

import {
	Badge,
	Button,
	EmptyState,
	RecordHeader,
	SearchInput,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { FileDown, Library, PenLine } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DatasetRef } from "../api";
import { Page, PageBody } from "../parts";
import { useClaims, useStandardsQuery } from "../queries";
import type { Standard } from "../types";
import { ImportSkosDialog } from "./ImportSkosDialog";
import { WriteStandardDialog } from "./WriteStandardDialog";

/** `/datasets/standards/<publisher>/<name>` */
function standardPath(s: DatasetRef): string {
	return `/datasets/standards/${encodeURIComponent(s.publisher)}/${encodeURIComponent(s.name)}`;
}

/** How many datasets claim each standard, keyed by its unversioned address. */
function useClaimCounts(): Map<string, number> {
	const { claims } = useClaims();
	const counts = new Map<string, number>();
	for (const c of claims) {
		const address = c.attachment.standard.split("@")[0] ?? "";
		counts.set(address, (counts.get(address) ?? 0) + 1);
	}
	return counts;
}

function summary(s: Standard, claimed: number): string {
	return [
		s.description,
		s.current_version !== null ? `v${s.current_version}` : "no version yet",
		`${s.terms.length} term${s.terms.length === 1 ? "" : "s"}`,
		claimed
			? claimed === 1
				? "1 dataset claims it"
				: `${claimed} datasets claim it`
			: "not used yet",
	]
		.filter(Boolean)
		.join(" · ");
}

export function StandardsPage() {
	const navigate = useNavigate();
	const [q, setQ] = useState("");
	const [writing, setWriting] = useState(false);
	const [importing, setImporting] = useState(false);
	const library = useStandardsQuery(q.trim() || undefined);
	const counts = useClaimCounts();
	const items = library.data?.items ?? [];

	return (
		<Page>
			<RecordHeader
				size="lg"
				crumbs={["Standards"]}
				chips={
					<Badge variant="outline" tone="muted" size="xs">
						{library.data?.total ?? 0}
					</Badge>
				}
				actions={
					<>
						<Button
							size="sm"
							variant="outline"
							onClick={() => setImporting(true)}
						>
							<FileDown />
							Import from SKOS
						</Button>
						<Button size="sm" onClick={() => setWriting(true)}>
							<PenLine />
							Write a standard
						</Button>
					</>
				}
			/>
			<PageBody>
				<p className="text-sm text-muted-foreground">
					Shared rules for data — vocabularies, required fields, ranges. A range
					used once is a constraint in Modeller.
				</p>
				<SearchInput
					inputSize="sm"
					value={q}
					onChange={setQ}
					placeholder="Search standards…"
					className="w-full"
				/>
				<PanelSection
					card
					title="Standards"
					action={
						<span className="text-sm text-muted-foreground">
							{items.length}
						</span>
					}
				>
					{library.isLoading ? (
						<Spinner />
					) : !items.length ? (
						<EmptyState
							icon={<Library className="size-6" />}
							title={q ? "No standard matches" : "No standards yet"}
							description="Write your lab's own, or import a published SKOS vocabulary."
						/>
					) : (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Standard</TableHead>
									<TableHead className="w-full">About</TableHead>
									<TableHead>Kind</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{items.map((s) => (
									<TableRow
										key={s.id}
										className="cursor-pointer"
										onClick={() => navigate(standardPath(s))}
									>
										<TableCell
											className="whitespace-nowrap font-medium"
											title={s.address}
										>
											{s.title || s.name}
										</TableCell>
										<TableCell className="max-w-0 truncate text-muted-foreground">
											{summary(s, counts.get(s.address) ?? 0)}
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												tone={s.origin === "pack" ? "info" : "success"}
												size="xs"
											>
												{s.origin}
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</PanelSection>
			</PageBody>
			{writing ? (
				<WriteStandardDialog
					open
					onClose={() => setWriting(false)}
					onCreated={(s) => navigate(standardPath(s))}
				/>
			) : null}
			{importing ? (
				<ImportSkosDialog
					open
					onClose={() => setImporting(false)}
					onImported={(r) => {
						const [publisher = "", name = ""] = r.address.split("/");
						navigate(standardPath({ publisher, name }));
					}}
				/>
			) : null}
		</Page>
	);
}
