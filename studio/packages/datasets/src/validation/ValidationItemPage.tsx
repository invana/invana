/**
 * **A validation item** — `/datasets/validation/<publisher>/<name>/<key>/<term>`
 * (datasets.md DS-07, board `datasets.validation.item`): one record that
 * breaks one term of a standard its dataset claims, the record beside the
 * term.
 *
 * Whoever can write the dataset resolves it with *Enter another value* and a
 * reason: the current version's records with that one value changed are
 * published as the next version, the reason as its `why`, so the record's
 * change log keeps both values. Anyone else reads the item and is told who
 * can fix it. *Use official* is not offered — there is no official value to
 * use without a validator agent.
 */

import { Input, Label } from "@invana/forms";
import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	EmptyState,
	PropertyList,
	PropertyRow,
	RecordHeader,
	Spinner,
} from "@invana/ui";
import { useAuth } from "@invana-studio/core";
import { FormError, PanelSection } from "@invana-studio/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { datasetsApi, parseAddress } from "../api";
import { datasetPath, useCanWrite } from "../dataset/context";
import { cell } from "../labels";
import { coerce, withValue } from "../nextVersion";
import { Page, PageBody, ReadState } from "../parts";
import {
	readBase,
	useDatasetQuery,
	useRecordQuery,
	useStandardQuery,
	useValidationQueue,
} from "../queries";
import type { AuthorStep } from "../types";
import { KIND_LABEL } from "./queue";

export function ValidationItemPage() {
	const { publisher = "", name = "", key = "", term = "" } = useParams();
	const ref = { publisher, name };
	const qc = useQueryClient();
	const { user } = useAuth();
	const dataset = useDatasetQuery(ref);
	const record = useRecordQuery(ref, key);
	const queue = useValidationQueue();
	const canWrite = useCanWrite(dataset.data);
	const [value, setValue] = useState("");
	const [reason, setReason] = useState("");

	const item = queue.data?.items.find(
		(i) =>
			i.dataset === `${publisher}/${name}` &&
			i.violation.key === key &&
			i.violation.term === term,
	);
	const pinned = item ? parseAddress(item.standard) : null;
	const standard = useStandardQuery(pinned ?? { publisher: "", name: "" });
	const termDef = standard.data?.terms.find((t) => t.name === term);

	const fix = useMutation({
		mutationFn: async () => {
			const d = dataset.data;
			if (!d || !item || d.current_version === null) {
				throw new Error("This dataset has no current version to fix.");
			}
			const who = user?.username ?? "me";
			const current = await readBase(d, d.current_version);
			const chain: AuthorStep[] = [
				...d.author_chain,
				{
					role: "modified_by",
					kind: "person",
					name: who,
					result: `${key} · ${item.column}`,
				},
			];
			return datasetsApi.publish(d, {
				licence: d.licence ?? "",
				author_chain: chain,
				records: withValue(current, key, item.column, coerce(value)),
				why: reason.trim(),
			});
		},
		onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
	});

	if (!dataset.data) {
		return <ReadState loading={dataset.isLoading} error={dataset.error} />;
	}
	const d = dataset.data;
	const title = `${key} · ${term}`;

	return (
		<Page>
			<RecordHeader
				size="lg"
				crumbs={[title]}
				chips={
					<Badge variant="outline" tone="warning" size="xs">
						standard
					</Badge>
				}
			/>
			<PageBody>
				{fix.data ? (
					<Alert tone="success">
						<CircleCheck />
						<AlertDescription>
							Published v{fix.data.version} — the record's change log keeps both
							values.{" "}
							<Link to={datasetPath(d, `records/${encodeURIComponent(key)}`)}>
								Open the record
							</Link>
						</AlertDescription>
					</Alert>
				) : null}

				{queue.isLoading ? (
					<Spinner />
				) : !item && !fix.data ? (
					<EmptyState
						title="Nothing to review here"
						description="This record conforms to every standard its dataset claims on the current version."
					/>
				) : (
					<div className="grid gap-3 md:grid-cols-2">
						<PanelSection
							card
							title={d.title || d.name}
							action={
								<span className="text-sm text-muted-foreground">
									v{record.data?.version ?? d.current_version}
								</span>
							}
						>
							{record.data ? (
								<PropertyList labelWidth={130}>
									{Object.entries(record.data.values).map(([k, v]) => (
										<PropertyRow key={k} label={k} mono>
											{cell(v)}
										</PropertyRow>
									))}
								</PropertyList>
							) : (
								<ReadState loading={record.isLoading} error={record.error} />
							)}
						</PanelSection>
						{item ? (
							<PanelSection card title={item.standard}>
								<PropertyList labelWidth={130}>
									<PropertyRow label="term">{term}</PropertyRow>
									<PropertyRow label="column" mono>
										{item.column}
									</PropertyRow>
									<PropertyRow label="value" mono>
										{cell(item.violation.value)}
									</PropertyRow>
									<PropertyRow label="breaks it by">
										{KIND_LABEL[item.violation.kind]}
									</PropertyRow>
									<PropertyRow label="allowed">
										{termDef?.values?.length
											? termDef.values.map((v) => v.label || v.code).join(" · ")
											: `any ${termDef?.type ?? "value"}`}
									</PropertyRow>
									<PropertyRow label="mode">{item.mode}</PropertyRow>
								</PropertyList>
							</PanelSection>
						) : null}
					</div>
				)}

				{item && !fix.data ? (
					canWrite ? (
						<PanelSection card title="Enter another value">
							<div className="flex flex-col gap-3">
								<div className="flex flex-col gap-1.5">
									<Label htmlFor="fix-value">{item.column}</Label>
									<Input
										id="fix-value"
										value={value}
										onChange={(e) => setValue(e.target.value)}
									/>
								</div>
								<div className="flex flex-col gap-1.5">
									<Label htmlFor="fix-reason">Reason</Label>
									<Input
										id="fix-reason"
										value={reason}
										onChange={(e) => setReason(e.target.value)}
										placeholder="Typo on the source page"
									/>
								</div>
								<FormError error={fix.error} />
								<Button
									size="sm"
									className="self-start"
									disabled={!value.trim() || !reason.trim() || fix.isPending}
									onClick={() => fix.mutate()}
								>
									Publish the fix as the next version
								</Button>
								<span className="text-sm text-muted-foreground">
									The record keeps both values in its change log.
								</span>
							</div>
						</PanelSection>
					) : (
						<span className="text-sm text-muted-foreground">
							Only {d.publisher}, who publishes this dataset, or an install
							Admin can fix it.
						</span>
					)
				) : null}
			</PageBody>
		</Page>
	);
}
