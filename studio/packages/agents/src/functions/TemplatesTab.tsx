/**
 * Functions › Templates — the answer templates this Graph renders with, as one
 * table, and *Author a template* as a modal.
 *
 * A template is to an answer what a plan is to a run: a definition, promoted
 * from what served. The engine returns a Graph's templates whole (its own and
 * the ones that ship with Invana), so the search and the kind and surface
 * presets narrow the rows on screen. A row opens the template's page as a tab
 * beside this one; publishing and removing are taken there.
 */

import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	EmptyState,
	SearchInput,
	SegmentedControl,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { ActButton } from "@invana-studio/shell";
import { DetailStatus, FormError } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useAgentsOpen } from "../open";
import { RowsFailed, RowsLoading, useTabList } from "./shared";
import {
	RESULT_SURFACES,
	useTemplateMutations,
	useTemplatesQuery,
} from "./templates";

const KIND_OPTIONS = [
	{ value: "all", label: "All" },
	{ value: "result", label: "Result" },
	{ value: "prompt", label: "Prompt" },
];

const SURFACE_OPTIONS = [
	{ value: "all", label: "Any surface" },
	...RESULT_SURFACES.map((s) => ({ value: s, label: s })),
];

export function TemplatesTab({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const open = useAgentsOpen();
	const { list, search } = useTabList([]);
	const templates = useTemplatesQuery(username, graphSlug);
	const [kind, setKind] = useState("all");
	const [surface, setSurface] = useState("all");
	const [authoring, setAuthoring] = useState(false);

	const all = templates.data ?? [];
	const q = search.trim().toLowerCase();
	const rows = all.filter(
		(t) =>
			(!q || `${t.name} ${t.surface} ${t.intent}`.toLowerCase().includes(q)) &&
			(kind === "all" || t.kind === kind) &&
			(surface === "all" || t.surface === surface),
	);

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<SearchInput
					inputSize="sm"
					value={search}
					onChange={list.setQ}
					placeholder="Find a template"
					className="w-72"
				/>
				<SegmentedControl
					size="xs"
					options={KIND_OPTIONS}
					value={kind}
					onValueChange={setKind}
					aria-label="Kind"
				/>
				<SegmentedControl
					size="xs"
					options={SURFACE_OPTIONS}
					value={surface}
					onValueChange={setSurface}
					aria-label="Surface"
				/>
				<ActButton
					area="build"
					size="sm"
					variant="outline"
					className="ml-auto"
					onClick={() => setAuthoring(true)}
				>
					<Plus />
					Author a template
				</ActButton>
			</div>
			{templates.isLoading ? (
				<RowsLoading />
			) : templates.isError ? (
				<RowsFailed what="The templates" error={templates.error} />
			) : rows.length === 0 ? (
				<EmptyState
					title={all.length ? "No template matches" : "No templates yet"}
					description={
						all.length
							? "Nothing in this Graph renders under that name, kind or surface."
							: "A template decides what an answer looks like. Author one, or promote the one an answer already served with."
					}
				/>
			) : (
				<Table density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Kind</TableHead>
							<TableHead>Name</TableHead>
							<TableHead className="w-full">What it shows</TableHead>
							<TableHead>Surface</TableHead>
							<TableHead>Version</TableHead>
							<TableHead className="whitespace-nowrap text-right">
								Answers citing it
							</TableHead>
							<TableHead>State</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((t) => (
							<TableRow
								key={t.id}
								className="cursor-pointer"
								onClick={() => open.template(t.id)}
							>
								<TableCell>
									<DetailStatus>{t.kind}</DetailStatus>
								</TableCell>
								<TableCell className="whitespace-nowrap font-mono">
									{t.name}
								</TableCell>
								<TableCell>
									{t.intent || (
										<span className="text-muted-foreground">
											no intent stated
										</span>
									)}
								</TableCell>
								<TableCell>{t.surface}</TableCell>
								<TableCell>v{t.version}</TableCell>
								<TableCell className="text-right">
									{t.used.toLocaleString()}
								</TableCell>
								<TableCell className="whitespace-nowrap">
									<span className="flex gap-1">
										<DetailStatus
											tone={t.status === "published" ? "success" : "warning"}
										>
											{t.status}
										</DetailStatus>
										{t.shipped ? <DetailStatus>shipped</DetailStatus> : null}
									</span>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
			{authoring ? (
				<AuthorTemplateDialog
					username={username}
					graphSlug={graphSlug}
					onClose={() => setAuthoring(false)}
					onAuthored={(id) => {
						setAuthoring(false);
						open.template(id);
					}}
				/>
			) : null}
		</div>
	);
}

/** *Author a template* — a result template, saved as a draft. Mounted only while open. */
function AuthorTemplateDialog({
	username,
	graphSlug,
	onClose,
	onAuthored,
}: {
	username: string;
	graphSlug: string;
	onClose: () => void;
	onAuthored: (id: string) => void;
}) {
	const { create } = useTemplateMutations(username, graphSlug);
	const [name, setName] = useState("");
	const [surface, setSurface] = useState<string>("table");
	const [intent, setIntent] = useState("");

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Author a template</DialogTitle>
					<DialogDescription>
						Saved as a draft. Publishing makes it offered to answers of the
						shapes it accepts; removing it is refused while answers still cite
						it.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="template-name">Name</Label>
						<Input
							id="template-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="top-movers"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label>Surface</Label>
						<Select value={surface} onValueChange={setSurface}>
							<SelectTrigger aria-label="Surface">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{RESULT_SURFACES.map((s) => (
									<SelectItem key={s} value={s}>
										{s}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="template-intent">Intent</Label>
						<Input
							id="template-intent"
							value={intent}
							onChange={(e) => setIntent(e.target.value)}
							placeholder="a shape across categories"
						/>
						<span className="text-sm text-muted-foreground">
							What it is for, so an answer can select it the way a plan is
							selected.
						</span>
					</div>
					<FormError error={create.error} />
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!name.trim() || create.isPending}
						onClick={() =>
							create.mutate(
								{ name: name.trim(), surface, intent: intent.trim() },
								{ onSuccess: (t) => onAuthored(t.id) },
							)
						}
					>
						Save as a draft
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
