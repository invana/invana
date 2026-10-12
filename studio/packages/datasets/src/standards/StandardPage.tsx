/**
 * **A standard** — `/datasets/standards/<publisher>/<name>` (datasets.md
 * DS-08, board `datasets.standard`): its terms and the values each allows, its
 * version, and the datasets that claim it.
 *
 * *Used by* is drawn from `useClaims` — every claim on this standard, at any
 * pinned version, with its mode and the current conformance. *Attach to a
 * dataset* opens the attach dialog with the standard fixed; the person picks
 * one of the datasets they can write.
 */

import {
	Badge,
	Button,
	EmptyState,
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
import { FileCheck2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AttachStandardDialog } from "../AttachStandardDialog";
import { datasetPath } from "../dataset/context";
import { percent } from "../labels";
import { Page, PageBody, ReadState } from "../parts";
import { useClaims, useStandardQuery } from "../queries";
import type { StandardTerm } from "../types";

function allowed(t: StandardTerm): string {
	if (!t.values?.length) return "any";
	return t.values.map((v) => v.label || v.code).join(" · ");
}

export function StandardPage() {
	const { publisher = "", name = "" } = useParams();
	const navigate = useNavigate();
	const query = useStandardQuery({ publisher, name });
	const { claims, isLoading } = useClaims();
	const [attaching, setAttaching] = useState(false);
	const standard = query.data;

	if (!standard) {
		return <ReadState loading={query.isLoading} error={query.error} />;
	}

	const usedBy = claims.filter(
		(c) => c.attachment.standard.split("@")[0] === standard.address,
	);

	return (
		<Page>
			<RecordHeader
				size="lg"
				crumbs={[standard.title || standard.name]}
				chips={
					<>
						<Badge
							variant="outline"
							tone={standard.origin === "pack" ? "info" : "success"}
							size="xs"
						>
							{standard.origin}
						</Badge>
						<Badge variant="outline" tone="muted" size="xs">
							{standard.current_version !== null
								? `v${standard.current_version}`
								: "no version yet"}
						</Badge>
					</>
				}
				actions={
					<Button
						variant="outline"
						size="sm"
						disabled={standard.current_version === null}
						onClick={() => setAttaching(true)}
					>
						<FileCheck2 />
						Attach to a dataset
					</Button>
				}
			/>
			<PageBody>
				<p className="text-sm text-muted-foreground">
					{[
						standard.address,
						standard.description,
						`${standard.terms.length} term${standard.terms.length === 1 ? "" : "s"}`,
					]
						.filter(Boolean)
						.join(" · ")}
				</p>
				<PanelSection
					card
					title="Terms"
					action={
						<span className="text-sm text-muted-foreground">
							{standard.terms.length}
						</span>
					}
				>
					{!standard.terms.length ? (
						<EmptyState
							title="No terms"
							description="A standard is scored by its terms; this one has none yet."
						/>
					) : (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Term</TableHead>
									<TableHead>Id</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Required</TableHead>
									<TableHead className="w-full">Allowed</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{standard.terms.map((t) => (
									<TableRow key={t.name}>
										<TableCell
											className="whitespace-nowrap font-medium"
											title={t.description ?? undefined}
										>
											{t.name}
										</TableCell>
										<TableCell className="font-mono text-muted-foreground">
											{t.iri ?? "—"}
										</TableCell>
										<TableCell>{t.type ?? "text"}</TableCell>
										<TableCell>{t.required ? "yes" : "no"}</TableCell>
										<TableCell className="max-w-0 truncate">
											{allowed(t)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</PanelSection>

				<PanelSection
					card
					title="Used by"
					action={
						<span className="text-sm text-muted-foreground">
							{usedBy.length}
						</span>
					}
				>
					{isLoading ? (
						<Spinner />
					) : !usedBy.length ? (
						<EmptyState
							title="No dataset claims it"
							description="Attach it to a dataset you publish to score every version against it."
						/>
					) : (
						<Table bordered={false} density="compact">
							<TableBody>
								{usedBy.map(({ dataset, attachment: a }) => (
									<TableRow key={`${dataset.id}-${a.standard}`}>
										<TableCell className="w-full font-medium">
											{dataset.title || dataset.name}
										</TableCell>
										<TableCell className="whitespace-nowrap text-muted-foreground">
											{[
												"dataset",
												a.mode,
												a.conformance ? percent(a.conformance.score) : null,
												`pins v${a.version}`,
											]
												.filter(Boolean)
												.join(" · ")}
										</TableCell>
										<TableCell>
											<Button
												variant="ghost"
												size="xs"
												onClick={() =>
													navigate(datasetPath(dataset, "conformance"))
												}
											>
												Open
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</PanelSection>
			</PageBody>
			{attaching ? (
				<AttachStandardDialog
					open
					standard={standard}
					onClose={() => setAttaching(false)}
				/>
			) : null}
		</Page>
	);
}
