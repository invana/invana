/**
 * **Save as dataset** — a simulation's ranked rows published as one `derived`
 * dataset (simulation.md, Save as dataset).
 *
 * The dataset's key column is the row label (`cross`); each row flattens to
 * the label, `meets_all` and each trait's `_mean · _sd · _meets`. Its first
 * version's `derived_from` is the simulation's pinned inputs, and its author
 * chain is one `original` step of kind `run` naming the simulation and its
 * run — so a reader of the dataset can follow it back to what it was computed
 * from. The name, title and licence are asked for; the rest is the record.
 *
 * Nothing here imports Datasets: it writes through the existing datasets API.
 * A refusal — a name already taken, a role that cannot publish — stays in the
 * dialog in the engine's words. Saved, the dialog says where the dataset is
 * and offers to open it.
 */

import { Input, Label } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { useEffect, useState } from "react";
import { useSimulationMutations } from "../records/queries";
import { branchLabel } from "../records/words";
import type { Project, Simulation } from "../types";
import { flattenRows, isSlug, rowLabelKey, toSlug } from "./specForm";

export function SaveAsDatasetDialog({
	open,
	onClose,
	project,
	refKey,
	simulation,
	onOpenDataset,
}: {
	open: boolean;
	onClose: () => void;
	project: Project;
	refKey: { username: string; graphSlug: string; key: string };
	simulation: Simulation;
	onOpenDataset?: (address: string) => void;
}) {
	const { saveAsDataset } = useSimulationMutations(refKey);
	const reset = saveAsDataset.reset;
	const s = simulation;
	const fallbackName = toSlug(`${project.key}-s${s.number}`);
	const fallbackTitle = `Simulation s${s.number} · ${s.simulator.title}`;

	const [name, setName] = useState(fallbackName);
	const [title, setTitle] = useState(fallbackTitle);
	const [licence, setLicence] = useState("CC-BY-4.0");

	useEffect(() => {
		if (!open) return;
		setName(fallbackName);
		setTitle(fallbackTitle);
		setLicence("CC-BY-4.0");
		reset();
	}, [open, fallbackName, fallbackTitle, reset]);

	const saved = saveAsDataset.data;
	const ranked = s.result?.ranked ?? [];
	const ready =
		isSlug(name) && !!title.trim() && !!licence.trim() && ranked.length > 0;

	const save = () => {
		if (!ready || !s.run_id) return;
		saveAsDataset.mutate({
			dataset: {
				name,
				title: title.trim(),
				description: "",
				origin: "derived",
				key_column: rowLabelKey(ranked),
			},
			version: {
				licence: licence.trim(),
				records: flattenRows(ranked),
				derived_from: s.inputs.map((i) => i.ref),
				author_chain: [
					{
						role: "original",
						kind: "run",
						name: `${title.trim()} · run ${s.run_id.slice(0, 8)}`,
						ref: s.run_id,
					},
				],
				why: `Simulation s${s.number} on ${branchLabel(project, s.branch)}`,
			},
		});
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Save as dataset</DialogTitle>
					<DialogDescription>
						Published with origin derived, from the{" "}
						{s.inputs.length === 1 ? "one input" : `${s.inputs.length} inputs`}{" "}
						it was computed from.
					</DialogDescription>
				</DialogHeader>
				{saved ? (
					<div className="flex flex-col gap-1.5">
						<p>Saved.</p>
						<p className="font-mono text-sm text-muted-foreground">
							{saved.publisher}/{saved.name}@1
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="derived-name">Name</Label>
							<Input
								id="derived-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
							{name && !isSlug(name) ? (
								<p className="text-sm text-muted-foreground">
									Lower-case letters, digits and hyphens, starting with a letter
									or digit.
								</p>
							) : null}
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="derived-title">Title</Label>
							<Input
								id="derived-title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="derived-licence">Licence</Label>
							<Input
								id="derived-licence"
								value={licence}
								onChange={(e) => setLicence(e.target.value)}
							/>
						</div>
						<FormError error={saveAsDataset.error as Error | null} />
					</div>
				)}
				<DialogFooter>
					{saved ? (
						<>
							<Button variant="ghost" onClick={onClose}>
								Close
							</Button>
							{onOpenDataset ? (
								<Button
									onClick={() =>
										onOpenDataset(`${saved.publisher}/${saved.name}`)
									}
								>
									Open in Datasets
								</Button>
							) : null}
						</>
					) : (
						<>
							<Button variant="ghost" onClick={onClose}>
								Cancel
							</Button>
							<Button
								disabled={!ready || saveAsDataset.isPending}
								onClick={save}
							>
								{saveAsDataset.isPending ? "Saving…" : "Save dataset"}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
