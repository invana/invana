/**
 * Functions › Templates — the answer templates this Graph renders with, as one
 * table, and *Author a template* as a modal.
 *
 * A template is to an answer what a plan is to a run: a definition, promoted
 * from what served. The list holds this Graph's templates and the ones that
 * ship with Invana; the search and the kind and surface presets — kept in the
 * URL as `q`, `f.kind` and `f.surface`, shown as chips with *N of M match* and
 * *Clear all* — are sent to the engine, which narrows and counts the rows.
 * *Accepts* is the shape a template declares it can render, as the engine
 * stores it. A row opens the template's page as a tab beside this one;
 * removing is taken there. *Author a template* takes the whole template —
 * kind, surface, what it accepts and its shape — and saves it as a draft or
 * publishes it at once.
 */

import {
	Field,
	FieldDescription,
	FieldLabel,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@invana/forms";
import {
	Badge,
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
	TypographyInlineCode,
} from "@invana/ui";
import { ActButton } from "@invana-studio/shell";
import { DetailStatus, FormError } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
	FilteredEmpty,
	filterValue,
	ListStrip,
	matchCount,
	setOne,
} from "../lists";
import { useAgentsOpen } from "../open";
import { RowsFailed, RowsLoading, useTabList } from "./shared";
import {
	acceptsFor,
	acceptsLine,
	PROMPT_SURFACES,
	parseAccepts,
	parseShape,
	RESULT_SURFACES,
	type TemplateKind,
	useTemplateListQuery,
	useTemplateMutations,
} from "./templates";

/** The filters this tab sends; `q` goes with them. */
const FILTERS = ["kind", "surface"];

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
	const { list, query, search } = useTabList(FILTERS);
	const templates = useTemplateListQuery(username, graphSlug, query);
	const [authoring, setAuthoring] = useState(false);
	const kind = filterValue(list, "kind");
	const surface = filterValue(list, "surface");

	const page = templates.data;
	const rows = page?.items ?? [];

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
				{/* Presets of the `kind` and `surface` filters: picking one shows as its chip. */}
				<SegmentedControl
					size="xs"
					options={KIND_OPTIONS}
					value={kind || "all"}
					onValueChange={(v) => setOne(list, "kind", v === "all" ? "" : v)}
					aria-label="Kind"
				/>
				<SegmentedControl
					size="xs"
					options={SURFACE_OPTIONS}
					value={surface || "all"}
					onValueChange={(v) => setOne(list, "surface", v === "all" ? "" : v)}
					aria-label="Surface"
				/>
				{page ? (
					<Badge variant="outline" tone="muted" size="xs" className="ml-auto">
						{matchCount(page, "templates")}
					</Badge>
				) : null}
				<ActButton
					area="build"
					size="sm"
					variant="outline"
					className={page ? undefined : "ml-auto"}
					onClick={() => setAuthoring(true)}
				>
					<Plus />
					Author a template
				</ActButton>
			</div>
			<ListStrip page={page} list={list} />
			{templates.isLoading ? (
				<RowsLoading />
			) : templates.isError ? (
				<RowsFailed what="The templates" error={templates.error} />
			) : rows.length === 0 ? (
				page?.applied.length ? (
					<FilteredEmpty
						noun="template"
						filters={page.applied}
						onClear={list.clear}
					/>
				) : (
					<EmptyState
						title="No templates yet"
						description="A template decides what an answer looks like. Author one, or promote the one an answer already served with."
					/>
				)
			) : (
				<Table density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Kind</TableHead>
							<TableHead>Name</TableHead>
							<TableHead className="w-full">What it shows</TableHead>
							<TableHead>Surface</TableHead>
							<TableHead>Accepts</TableHead>
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
								<TableCell className="whitespace-nowrap">
									<TypographyInlineCode>{t.name}</TypographyInlineCode>
								</TableCell>
								<TableCell>
									{t.intent || (
										<span className="text-muted-foreground">
											no intent stated
										</span>
									)}
								</TableCell>
								<TableCell>{t.surface}</TableCell>
								<TableCell className="whitespace-nowrap font-mono text-muted-foreground">
									{acceptsLine(t.accepts) || "anything"}
								</TableCell>
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

const SURFACES_OF: Record<TemplateKind, readonly string[]> = {
	result: RESULT_SURFACES,
	prompt: PROMPT_SURFACES,
};

/**
 * *Author a template* — kind, name, surface, accepts, shape and intent;
 * *Save as a draft* or *Publish*. Accepts follows the surface until it is
 * edited. Mounted only while open.
 */
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
	const [kind, setKind] = useState<TemplateKind>("result");
	const [name, setName] = useState("");
	const [surface, setSurface] = useState<string>("table");
	const [accepts, setAccepts] = useState(() =>
		acceptsLine(acceptsFor("result", "table")),
	);
	const [acceptsEdited, setAcceptsEdited] = useState(false);
	const [shape, setShape] = useState("");
	const [intent, setIntent] = useState("");

	const pick = (nextKind: TemplateKind, nextSurface: string) => {
		setKind(nextKind);
		setSurface(nextSurface);
		if (!acceptsEdited)
			setAccepts(acceptsLine(acceptsFor(nextKind, nextSurface)));
	};
	const submit = (publish: boolean) =>
		create.mutate(
			{
				draft: {
					name: name.trim(),
					kind,
					surface,
					intent: intent.trim(),
					accepts: parseAccepts(accepts),
					spec: parseShape(shape),
				},
				publish,
			},
			{ onSuccess: (t) => onAuthored(t.id) },
		);

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Author a template</DialogTitle>
					<DialogDescription>
						Saved as a draft, or published at once. Publishing makes it offered
						to answers of the shapes it accepts and read-only after; removing it
						is refused while answers still cite it.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<Field>
						<FieldLabel htmlFor="template-name">Name</FieldLabel>
						<Input
							id="template-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="top-movers"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="template-kind">Kind</FieldLabel>
						<Select
							value={kind}
							onValueChange={(v) => {
								const next = v as TemplateKind;
								pick(next, SURFACES_OF[next][0]);
							}}
						>
							<SelectTrigger id="template-kind">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="result">result</SelectItem>
								<SelectItem value="prompt">prompt</SelectItem>
							</SelectContent>
						</Select>
						<FieldDescription>
							A result template renders an answer's records; a prompt template
							asks a closed question.
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor="template-surface">Surface</FieldLabel>
						<Select value={surface} onValueChange={(v) => pick(kind, v)}>
							<SelectTrigger id="template-surface">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{SURFACES_OF[kind].map((s) => (
									<SelectItem key={s} value={s}>
										{s}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor="template-accepts">Accepts</FieldLabel>
						<Input
							id="template-accepts"
							className="font-mono"
							value={accepts}
							onChange={(e) => {
								setAccepts(e.target.value);
								setAcceptsEdited(true);
							}}
							placeholder="result_type tabular · min_rows 1"
						/>
						<FieldDescription>
							The result shape it can render, one constraint per part — checked
							before it renders, so a result that does not fit is never drawn
							half-empty.
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor="template-shape">Shape</FieldLabel>
						<Textarea
							id="template-shape"
							className="font-mono"
							rows={4}
							value={shape}
							onChange={(e) => setShape(e.target.value)}
							placeholder={"x: month\ny: fare_median\nseries: carrier"}
						/>
						<FieldDescription>
							The surface's own definition, one{" "}
							<TypographyInlineCode>key: value</TypographyInlineCode> per line —
							axes for a chart, columns for a table.
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor="template-intent">Intent</FieldLabel>
						<Input
							id="template-intent"
							value={intent}
							onChange={(e) => setIntent(e.target.value)}
							placeholder="a shape across categories"
						/>
						<FieldDescription>
							What it is for, so an answer can select it the way a plan is
							selected.
						</FieldDescription>
					</Field>
					<FormError error={create.error} />
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="outline"
						disabled={!name.trim() || create.isPending}
						onClick={() => submit(false)}
					>
						Save as a draft
					</Button>
					<Button
						disabled={!name.trim() || create.isPending}
						onClick={() => submit(true)}
					>
						Publish
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
