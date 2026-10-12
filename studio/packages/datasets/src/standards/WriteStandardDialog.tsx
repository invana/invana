/**
 * **Write a standard** (board `datasets.standards`, DS-08): a lab's own rules
 * for data — each term a name, a type, whether a record must carry it, and the
 * values it allows.
 *
 * The standard is published under the writer's username as origin `authored`,
 * and its terms mint v1 in the same act. A term's values are typed as a comma
 * list; left empty, any value of the type conforms.
 */

import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
} from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useCreateStandard } from "../queries";
import type { Standard, StandardTerm, TermType } from "../types";

const TYPES: TermType[] = ["text", "integer", "number", "boolean", "date"];

interface TermDraft {
	name: string;
	type: TermType;
	required: boolean;
	values: string;
}

const blank = (): TermDraft => ({
	name: "",
	type: "text",
	required: false,
	values: "",
});

/** `100 Seed Weight` → `100-seed-weight` — the engine's slug. */
function slugOf(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 63);
}

function termOf(d: TermDraft): StandardTerm {
	const codes = d.values
		.split(",")
		.map((v) => v.trim())
		.filter(Boolean);
	return {
		name: d.name.trim(),
		type: d.type,
		required: d.required,
		values: codes.length ? codes.map((code) => ({ code })) : null,
	};
}

export function WriteStandardDialog({
	open,
	onClose,
	onCreated,
}: {
	open: boolean;
	onClose: () => void;
	onCreated: (standard: Standard) => void;
}) {
	const create = useCreateStandard();
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [terms, setTerms] = useState<TermDraft[]>([blank()]);
	const name = slugOf(title);
	const written = terms.filter((t) => t.name.trim());

	const edit = (i: number, patch: Partial<TermDraft>) =>
		setTerms((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

	const submit = () =>
		create.mutate(
			{
				name,
				title: title.trim(),
				description: description.trim(),
				origin: "authored",
				terms: written.map(termOf),
			},
			{ onSuccess: onCreated },
		);

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Write a standard</DialogTitle>
					<DialogDescription>
						Shared rules for data — vocabularies, required fields. A range used
						once is a constraint in Modeller.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="standard-title">Title</Label>
						<Input
							id="standard-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Lab protocol · 100-seed weight"
						/>
						<span className="text-sm text-muted-foreground">
							{name ? `Published as ${name}` : "The title names its address"}
						</span>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="standard-description">Description</Label>
						<Input
							id="standard-description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label>Terms</Label>
						<Table density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Required</TableHead>
									<TableHead className="w-full">Allowed values</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{terms.map((t, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity until named
									<TableRow key={i}>
										<TableCell>
											<Input
												aria-label={`Term ${i + 1} name`}
												value={t.name}
												onChange={(e) => edit(i, { name: e.target.value })}
											/>
										</TableCell>
										<TableCell>
											<Select
												value={t.type}
												onValueChange={(v) => edit(i, { type: v as TermType })}
											>
												<SelectTrigger aria-label={`Term ${i + 1} type`}>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{TYPES.map((type) => (
														<SelectItem key={type} value={type}>
															{type}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</TableCell>
										<TableCell>
											<Switch
												aria-label={`Term ${i + 1} required`}
												checked={t.required}
												onCheckedChange={(on) => edit(i, { required: on })}
											/>
										</TableCell>
										<TableCell>
											<Input
												aria-label={`Term ${i + 1} values`}
												value={t.values}
												onChange={(e) => edit(i, { values: e.target.value })}
												placeholder="any — or desi, kabuli"
											/>
										</TableCell>
										<TableCell>
											<Button
												variant="ghost"
												size="icon-xs"
												aria-label={`Remove term ${i + 1}`}
												disabled={terms.length === 1}
												onClick={() =>
													setTerms((ts) => ts.filter((_, j) => j !== i))
												}
											>
												<X />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						<Button
							variant="ghost"
							size="sm"
							className="self-start"
							onClick={() => setTerms((ts) => [...ts, blank()])}
						>
							<Plus />
							Add a term
						</Button>
					</div>
					<FormError error={create.error} />
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!name || !written.length || create.isPending}
						onClick={submit}
					>
						Publish v1
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
