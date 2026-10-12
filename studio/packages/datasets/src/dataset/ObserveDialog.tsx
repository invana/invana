/**
 * **Add observations** (board `datasets.observe`, DS-05): a few rows typed in
 * by the person who measured them, one field per column of the current
 * version.
 *
 * A version is the whole content, so saving reads the current version's
 * records and publishes them with the new rows as the next version, `why`
 * naming the observations and who made them. In a dataset whose origin is not
 * `observed`, each new row carries its own provenance — observed, by this
 * person — and every other record keeps the dataset's. A standard attached in
 * `block` refuses a row that breaks it, and nothing is written; `warn` saves
 * and says so. Above a few thousand records the form points to the CLI.
 */

import { Input, Label } from "@invana/forms";
import {
	Alert,
	AlertDescription,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import { useAuth } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { datasetsApi } from "../api";
import { coerce, FORM_LIMIT, type RecordRow, withAdded } from "../nextVersion";
import { readBase, useVersionsQuery } from "../queries";
import type { AuthorStep, Dataset, DatasetVersion } from "../types";

type Draft = Record<string, string>;

export function ObserveDialog({
	dataset,
	open,
	onClose,
}: {
	dataset: Dataset;
	open: boolean;
	onClose: () => void;
}) {
	const { user } = useAuth();
	const qc = useQueryClient();
	const versions = useVersionsQuery(dataset);
	const version = dataset.current_version;
	const columns = versions.data?.items.find((v) => v.version === version)
		?.columns ?? [dataset.key_column];
	const [drafts, setDrafts] = useState<Draft[]>([{}]);
	const [licence, setLicence] = useState(dataset.licence ?? "");
	const tooBig = dataset.record_count > FORM_LIMIT;
	const who = user?.username ?? "me";

	const save = useMutation({
		mutationFn: async (): Promise<DatasetVersion> => {
			const added: RecordRow[] = drafts.map((d) => {
				const row: RecordRow = Object.fromEntries(
					columns.map((c) => [c, coerce(d[c] ?? "")]),
				);
				return dataset.origin === "observed"
					? row
					: { ...row, _provenance: { origin: "observed", source: who } };
			});
			const current = version === null ? [] : await readBase(dataset, version);
			const n = added.length;
			const chain: AuthorStep[] =
				dataset.origin === "observed" && !dataset.author_chain.length
					? []
					: [
							...dataset.author_chain,
							{
								role: "modified_by",
								kind: "person",
								name: who,
								result: `${n} observation${n === 1 ? "" : "s"}`,
							},
						];
			return datasetsApi.publish(dataset, {
				licence: licence.trim(),
				author_chain: chain,
				records: withAdded(current, added, dataset.key_column),
				why: `${n} observation${n === 1 ? "" : "s"} by ${who}`,
			});
		},
		onSuccess: (v) => {
			void qc.invalidateQueries({ queryKey: ["datasets"] });
			if (!v.warnings?.length) close();
		},
	});

	const close = () => {
		setDrafts([{}]);
		save.reset();
		onClose();
	};

	const set = (i: number, column: string, value: string) =>
		setDrafts((all) =>
			all.map((d, j) => (j === i ? { ...d, [column]: value } : d)),
		);
	const ready =
		!tooBig &&
		licence.trim() !== "" &&
		drafts.every((d) => (d[dataset.key_column] ?? "").trim() !== "");
	const saved = save.data;

	return (
		<Dialog open={open} onOpenChange={(o) => !o && close()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Add observations</DialogTitle>
					<DialogDescription>
						{dataset.title || dataset.name} · {dataset.origin}
					</DialogDescription>
				</DialogHeader>

				{tooBig ? (
					<Alert tone="info">
						<AlertDescription>
							This dataset holds {dataset.record_count.toLocaleString()}{" "}
							records; the form adds to datasets of up to{" "}
							{FORM_LIMIT.toLocaleString()}. Use{" "}
							<code>invana datasets import</code> for the next version.
						</AlertDescription>
					</Alert>
				) : saved ? (
					<Alert tone="warning">
						<AlertDescription>
							Saved as v{saved.version}. {saved.warnings?.join(" ")}
						</AlertDescription>
					</Alert>
				) : (
					<div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
						{drafts.map((d, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and never reordered
								key={i}
								className="grid grid-cols-3 gap-3"
							>
								{columns.map((c) => (
									<div key={c} className="flex flex-col gap-1.5">
										<Label htmlFor={`obs-${i}-${c}`}>
											{c}
											{c === dataset.key_column ? " · key" : ""}
										</Label>
										<Input
											id={`obs-${i}-${c}`}
											value={d[c] ?? ""}
											onChange={(e) => set(i, c, e.target.value)}
										/>
									</div>
								))}
							</div>
						))}
						{dataset.licence ? null : (
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="obs-licence">Licence</Label>
								<Input
									id="obs-licence"
									value={licence}
									placeholder="CC BY 4.0"
									onChange={(e) => setLicence(e.target.value)}
								/>
							</div>
						)}
						<p className="text-sm text-muted-foreground">
							Recorded as observed by {who}, as v{(version ?? 0) + 1}. For a
							whole trial, use <code>invana datasets import</code>.
						</p>
						<FormError error={save.error} />
					</div>
				)}

				<DialogFooter>
					<Button variant="ghost" onClick={close}>
						{saved ? "Close" : "Cancel"}
					</Button>
					{saved ? null : (
						<>
							<Button
								variant="outline"
								disabled={tooBig}
								onClick={() => setDrafts((all) => [...all, {}])}
							>
								<Plus />
								Add another
							</Button>
							<Button
								disabled={!ready || save.isPending}
								onClick={() => save.mutate()}
							>
								Save {drafts.length} observation{drafts.length === 1 ? "" : "s"}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
