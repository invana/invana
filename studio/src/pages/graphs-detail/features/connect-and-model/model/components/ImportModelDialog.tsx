/**
 * Import a model — from a file, or from a starter shipped with the distribution.
 *
 * Both are the same path (starter-models.md SR1): a starter is an ordinary
 * artefact, so it lands as a **draft**, is renamed on arrival, and upgrades
 * later like anything else. Nothing in the product reads a starter's type names.
 *
 * The two seams the dialog has to state rather than swallow:
 *
 * - **A name already in use is named, never merged** (share-a-model.md C6). The
 *   engine refuses with the clashing model, and the dialog offers a new name.
 * - **A type this database cannot hold arrives anyway** (SM4), listed, with
 *   publishing blocked until it is resolved — not refused, not degraded.
 */

import {
	useImportModelMutation,
	useStartersQuery,
} from "@/hooks/queries/useModels";
import type { ModelArtefact, ModelImportResult } from "@/types/models";
import { Input } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Spinner,
} from "@invana/ui";
import { FileUp, Package } from "lucide-react";
import { useRef, useState } from "react";

interface Props {
	open: boolean;
	username: string;
	graphSlug: string;
	onClose: () => void;
	onImported: (modelId: string) => void;
}

export function ImportModelDialog({
	open,
	username,
	graphSlug,
	onClose,
	onImported,
}: Props) {
	const fileInput = useRef<HTMLInputElement>(null);
	const [artefact, setArtefact] = useState<ModelArtefact | null>(null);
	const [starter, setStarter] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [blockers, setBlockers] = useState<string[]>([]);

	const starters = useStartersQuery(username, graphSlug);
	const importModel = useImportModelMutation(username, graphSlug);

	const reset = () => {
		setArtefact(null);
		setStarter(null);
		setName("");
		setError(null);
		setBlockers([]);
	};

	const readFile = async (file: File) => {
		try {
			const parsed = JSON.parse(await file.text()) as ModelArtefact;
			if (!parsed.package_id || !parsed.model) {
				throw new Error("no package id");
			}
			setArtefact(parsed);
			setStarter(null);
			setName(parsed.name);
			setError(null);
		} catch {
			setError(
				"That file is not a model artefact. Export one with `invana models export` — it carries a package id and a content hash.",
			);
		}
	};

	const submit = () => {
		setBlockers([]);
		importModel.mutate(
			{
				artefact: artefact ?? undefined,
				starter: starter ?? undefined,
				name: name.trim() || undefined,
			},
			{
				onSuccess: (raw) => {
					const result = raw as ModelImportResult;
					if (result.unsupported_property_types.length) {
						// It landed. It just cannot publish here yet, and says which types.
						setBlockers(
							result.unsupported_property_types.map(
								(u) => `${u.property_key} (${u.type})`,
							),
						);
					}
					reset();
					onImported(result.model.id);
				},
			},
		);
	};

	const chosen = artefact?.name ?? starter;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					reset();
					onClose();
				}
			}}
		>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Import a model</DialogTitle>
					<DialogDescription>
						A model belongs to its domain, not to this Graph. It arrives as a
						draft, under whatever name you give it here.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<p className="mb-1.5 text-base font-medium">From a file</p>
						<input
							ref={fileInput}
							type="file"
							accept="application/json,.json"
							className="hidden"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) void readFile(file);
							}}
						/>
						<Button
							variant="outline"
							size="sm"
							onClick={() => fileInput.current?.click()}
						>
							<FileUp className="mr-1.5 h-4 w-4" />
							{artefact ? artefact.name : "Choose an artefact"}
						</Button>
						{artefact ? (
							<p className="mt-1 font-mono text-sm text-muted-foreground">
								{artefact.package_id} · {artefact.content_hash.slice(0, 12)}
							</p>
						) : null}
					</div>

					<div>
						<p className="mb-1.5 text-base font-medium">
							Or start from a starter
						</p>
						{starters.isLoading ? (
							<Spinner />
						) : (
							<div className="space-y-1.5">
								{(starters.data ?? []).map((s) => (
									<button
										key={s.slug}
										type="button"
										onClick={() => {
											setStarter(s.slug);
											setArtefact(null);
											setName(s.name);
											setError(null);
										}}
										className={`flex w-full items-start gap-2 rounded-sm border px-2.5 py-2 text-left text-base ${
											starter === s.slug
												? "border-primary/40 bg-primary/10"
												: "hover:bg-accent"
										}`}
									>
										<Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
										<span className="min-w-0">
											<span className="font-medium">{s.name}</span>
											<span className="block text-sm text-muted-foreground">
												{s.description}
											</span>
											<span className="block text-sm text-muted-foreground/80">
												{s.node_types.join(" · ")}
											</span>
										</span>
									</button>
								))}
							</div>
						)}
					</div>

					{chosen ? (
						<div>
							<p className="mb-1.5 text-base font-medium">Call it</p>
							<Input
								value={name}
								onChange={(e: { target: { value: string } }) =>
									setName(e.target.value)
								}
								placeholder={chosen}
							/>
							<p className="mt-1 text-sm text-muted-foreground">
								The name is local — the package id is what an upgrade resolves
								against, so renaming costs nothing.
							</p>
						</div>
					) : null}

					{error ? <p className="text-base text-destructive">{error}</p> : null}
					{blockers.length ? (
						<p className="text-base text-warning">
							Imported, but it cannot publish here yet — this database cannot
							hold {blockers.join(", ")}.
						</p>
					) : null}
				</div>

				<div className="flex justify-end gap-2">
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={submit} disabled={!chosen || importModel.isPending}>
						{importModel.isPending ? "Importing…" : "Import as a draft"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
