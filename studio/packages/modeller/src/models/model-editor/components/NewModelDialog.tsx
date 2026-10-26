/**
 * New model — one dialog: a name, a description, and where to start.
 *
 * | Start from | What happens |
 * |---|---|
 * | Describe it | the draft is made, then a Modeller session bound to it is asked the description |
 * | A file | the artefact lands as a draft under the name typed |
 * | A starter | the shipped model lands as a draft under the name typed |
 *
 * *Create draft* always lands on the new model's draft canvas. A name already
 * in use is named by the engine and offered back, never merged; a type this
 * database cannot hold arrives anyway, listed, and blocks publishing.
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
	Spinner,
} from "@invana/ui";
import { sessionsApi } from "@invana-studio/assistant";
import { ApiError } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { modelsApi } from "../../api";
import { useStartersQuery } from "../../queries";
import type { ModelArtefact } from "../../types";

type Start = "describe" | "file" | "starter";

interface Props {
	open: boolean;
	username: string;
	graphSlug: string;
	onClose: () => void;
	/** `assistant` is true when the draft was opened with the description asked. */
	onCreated: (modelId: string, opts: { assistant: boolean }) => void;
}

export function NewModelDialog({
	open,
	username,
	graphSlug,
	onClose,
	onCreated,
}: Props) {
	const fileInput = useRef<HTMLInputElement>(null);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [start, setStart] = useState<Start>("describe");
	const [artefact, setArtefact] = useState<ModelArtefact | null>(null);
	const [starter, setStarter] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const starters = useStartersQuery(username, graphSlug);
	const starterList = starters.data ?? [];

	const reset = () => {
		setName("");
		setDescription("");
		setStart("describe");
		setArtefact(null);
		setStarter(null);
		setError(null);
	};

	const close = () => {
		reset();
		onClose();
	};

	const readFile = async (file: File) => {
		try {
			const parsed = JSON.parse(await file.text()) as ModelArtefact;
			if (!parsed.package_id || !parsed.model) throw new Error("no package id");
			setArtefact(parsed);
			setError(null);
		} catch {
			setArtefact(null);
			setError(
				"That file is not a model artefact. Export one with `invana models export` — it carries a package id and a content hash.",
			);
		}
	};

	const canCreate =
		!busy &&
		(start === "describe"
			? name.trim().length > 0
			: start === "file"
				? artefact !== null
				: starter !== null);

	const describeIt = async (modelId: string, text: string) => {
		try {
			const session = await sessionsApi.create(username, graphSlug, {
				surface: "modeller",
				model_id: modelId,
				title: name.trim(),
			});
			// The reply streams into the session; the draft does not wait for it.
			sessionsApi
				.sendMessage(username, graphSlug, session.id, {
					mode: "nl",
					content: text,
				})
				.catch((err) =>
					toast.error(
						err instanceof Error
							? err.message
							: "The assistant did not answer.",
					),
				);
			return true;
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "The assistant could not draft from the description.",
			);
			return false;
		}
	};

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!canCreate) return;
		setBusy(true);
		setError(null);
		try {
			const typed = name.trim();
			if (start === "describe") {
				const text = description.trim();
				const model = await modelsApi.create(username, graphSlug, {
					name: typed,
					description: text,
				});
				// The empty draft stays whether or not the ask is taken.
				const asked = text ? await describeIt(model.id, text) : false;
				reset();
				onCreated(model.id, { assistant: asked });
				return;
			}
			const result = await modelsApi.importModel(username, graphSlug, {
				...(start === "file"
					? { artefact: artefact ?? undefined }
					: { starter: starter ?? undefined }),
				name: typed || undefined,
			});
			if (result.unsupported_property_types.length) {
				toast.warning(
					`Created, but it cannot publish here yet — this database cannot hold ${result.unsupported_property_types
						.map((u) => `${u.property_key} (${u.type})`)
						.join(", ")}.`,
				);
			}
			reset();
			onCreated(result.model.id, { assistant: false });
		} catch (err) {
			setError(
				err instanceof ApiError || err instanceof Error
					? err.message
					: "Could not create the model.",
			);
		} finally {
			setBusy(false);
		}
	};

	const choice = (id: Start, title: string, hint: string) => (
		<button
			type="button"
			aria-pressed={start === id}
			onClick={() => {
				setStart(id);
				setError(null);
			}}
			className={`rounded-sm border px-3 py-2 text-left ${
				start === id ? "border-primary ring-1 ring-primary" : "hover:bg-accent"
			}`}
		>
			<span className="block font-medium">{title}</span>
			<span className="block text-sm text-muted-foreground">{hint}</span>
		</button>
	);

	return (
		<Dialog open={open} onOpenChange={(next) => !next && close()}>
			<DialogContent className="max-w-2xl">
				<form onSubmit={submit}>
					<DialogHeader>
						<DialogTitle>New model</DialogTitle>
						<DialogDescription className="sr-only">
							Name it, describe it, and choose where it starts. It arrives as a
							draft.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 pt-4">
						<div className="space-y-1.5">
							<Label htmlFor="new-model-name">Name</Label>
							<Input
								id="new-model-name"
								value={name}
								placeholder={artefact?.name ?? undefined}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="new-model-description">Description</Label>
							<Input
								id="new-model-description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<Label>Start from</Label>
							<div className="grid grid-cols-3 gap-2">
								{choice("describe", "Describe it", "the assistant drafts")}
								{choice("file", "A file", "JSON artefact")}
								{choice(
									"starter",
									"A starter",
									`${starterList.length} templates`,
								)}
							</div>
						</div>

						{start === "file" ? (
							<div>
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
									type="button"
									variant="outline"
									size="sm"
									onClick={() => fileInput.current?.click()}
								>
									{artefact ? artefact.name : "Choose an artefact"}
								</Button>
								{artefact ? (
									<p className="mt-1 font-mono text-sm text-muted-foreground">
										{artefact.package_id} · {artefact.content_hash.slice(0, 12)}
									</p>
								) : null}
							</div>
						) : null}

						{start === "starter" ? (
							starters.isLoading ? (
								<Spinner />
							) : (
								<div className="space-y-1.5">
									{starterList.map((s) => (
										<button
											key={s.slug}
											type="button"
											aria-pressed={starter === s.slug}
											onClick={() => setStarter(s.slug)}
											className={`block w-full rounded-sm border px-2.5 py-2 text-left ${
												starter === s.slug
													? "border-primary bg-primary/10"
													: "hover:bg-accent"
											}`}
										>
											<span className="font-medium">{s.name}</span>
											<span className="block text-sm text-muted-foreground">
												{s.description}
											</span>
											<span className="block text-sm text-muted-foreground">
												{s.node_types.join(" · ")}
											</span>
										</button>
									))}
								</div>
							)
						) : null}
					</div>

					<FormError error={error} className="mt-4" />
					<DialogFooter>
						<Button type="button" variant="ghost" onClick={close}>
							Cancel
						</Button>
						<Button type="submit" disabled={!canCreate}>
							{busy ? "Creating…" : "Create draft"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
