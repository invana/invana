/**
 * Projection templates — the third drawer of the **Library** stack
 * (projections.md § 5 · graph-detail-page.md G38 · G41).
 *
 * A projection template is to an answer what a plan is to a run: both are
 * definitions, both are promoted from what served (projections.md C7). So it
 * has no rail icon of its own and sits under `Plans` and `Catalogue` — the two
 * other things a run is composed from. What this file owns is the **body**: the
 * drawer draws the header, the count, the search and the `+` (G32).
 *
 * A projection template is what stops the model from authoring markup (P1), so
 * it is authored here by a person and versioned like anything else that decides
 * what an answer looks like.
 *
 * Three facts this surface has to be honest about:
 *
 * - **A shipped template belongs to every Graph.** The five that come with the
 *   distribution have no owner and are not this Graph's to edit or delete; the
 *   row says so instead of failing on save.
 * - **A published template is read-only.** An answer rendered with it must not
 *   change shape after the fact, so a change publishes a new version.
 * - **Usage is the argument for promoting one** (P7). `rendered 41×` is the
 *   whole reason a one-off becomes a default, so it is on the row.
 */

import {
	DetailBlock,
	DetailStatus,
} from "@/pages/graphs-detail/shared/DetailRows";
import { WorkRow } from "@/pages/graphs-detail/shared/WorkRow";
import {
	type ProjectionTemplateRead,
	projectionTemplatesApi,
} from "@/services/api/runs";
import { PanelSection } from "@/ui/PanelSection";
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
	CardFooter,
	EmptyState,
	PropertyRow,
	Spinner,
} from "@invana/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

const RESULT_SURFACES = [
	"table",
	"metric",
	"chart",
	"subgraph",
	"markdown",
] as const;

export const templatesKey = (username: string, graphSlug: string) =>
	["projection-templates", username, graphSlug] as const;

function useTemplatesQuery(username: string, graphSlug: string) {
	return useQuery({
		queryKey: templatesKey(username, graphSlug),
		queryFn: () => projectionTemplatesApi.list(username, graphSlug),
	});
}

/**
 * The drilled-in drawer header's trail. A template's id is a uuid and says
 * nothing, so the header carries its **name** — read from the list already in
 * cache rather than by a second request.
 */
export function TemplateTrail({
	username,
	graphSlug,
	id,
}: {
	username: string;
	graphSlug: string;
	id: string;
}) {
	const templates = useTemplatesQuery(username, graphSlug);
	const found = templates.data?.find((t) => t.id === id);
	return <>{found?.name ?? id.slice(0, 8)}</>;
}

/** `11 · 5 result` — what the drawer header carries beside its label. */
export function TemplatesCount({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const templates = useTemplatesQuery(username, graphSlug);
	const rows = templates.data ?? [];
	if (!rows.length) return null;
	const results = rows.filter((t) => t.kind === "result").length;
	return <>{`${rows.length} · ${results} result`}</>;
}

interface BodyProps {
	username: string;
	graphSlug: string;
	/** The live search string from the drawer header, empty when closed. */
	search?: string;
	/** The drawer's own filters — `kind` and `surface` (§3a). */
	kindFilter?: string;
	surfaceFilter?: string;
	/** `&template=` — the template whose detail replaces this drawer's body. */
	selectedId: string | null;
	onSelect: (id: string | null) => void;
	/** True while the drawer's `+` has the author form open. */
	authoring?: boolean;
	onAuthored?: () => void;
}

/**
 * The drawer's body: the author form, one template read end to end, or the
 * two-section list — `Result` over `Prompt`, which is the order a person meets
 * them in (an answer is rendered before a question is asked back).
 */
export function TemplatesDrawerBody({
	username,
	graphSlug,
	search = "",
	kindFilter = "",
	surfaceFilter = "",
	selectedId,
	onSelect,
	authoring,
	onAuthored,
}: BodyProps) {
	const qc = useQueryClient();
	const templates = useTemplatesQuery(username, graphSlug);
	const invalidate = () =>
		qc.invalidateQueries({ queryKey: templatesKey(username, graphSlug) });

	const publish = useMutation({
		mutationFn: (id: string) =>
			projectionTemplatesApi.publish(username, graphSlug, id),
		onSuccess: invalidate,
	});
	const remove = useMutation({
		mutationFn: (id: string) =>
			projectionTemplatesApi.remove(username, graphSlug, id),
		onSuccess: () => {
			invalidate();
			// The row it was drilled into is gone, so the drawer goes back to the
			// list rather than showing a detail for a record that no longer exists.
			onSelect(null);
		},
	});

	if (authoring) {
		return (
			<TemplateForm
				username={username}
				graphSlug={graphSlug}
				onDone={() => {
					invalidate();
					onAuthored?.();
				}}
			/>
		);
	}

	if (templates.isLoading) {
		return (
			<div className="p-4">
				<Spinner />
			</div>
		);
	}

	const all = templates.data ?? [];

	const selected = selectedId
		? (all.find((t) => t.id === selectedId) ?? null)
		: null;
	if (selectedId && !selected) {
		return (
			<EmptyState
				className="p-4"
				title="That template is gone"
				description="It was removed, or it belongs to another Graph. The list beside it is the ones this Graph can render with."
			/>
		);
	}
	if (selected) {
		return (
			<TemplateDetail
				template={selected}
				onPublish={() => publish.mutate(selected.id)}
				onDelete={() => remove.mutate(selected.id)}
			/>
		);
	}

	const q = search.trim().toLowerCase();
	const rows = all.filter(
		(t) =>
			(!q || `${t.name} ${t.surface} ${t.intent}`.toLowerCase().includes(q)) &&
			(!kindFilter || t.kind === kindFilter) &&
			(!surfaceFilter || t.surface === surfaceFilter),
	);

	const narrowed = Boolean(q || kindFilter || surfaceFilter);
	if (!rows.length) {
		return (
			<EmptyState
				className="p-4"
				title={narrowed ? "No template matches" : "No templates yet"}
				description={
					narrowed
						? "Nothing in this Graph renders under that name, surface or intent."
						: "A template decides what an answer looks like. Author one here, or promote the one an answer already served with."
				}
			/>
		);
	}

	const results = rows.filter((t) => t.kind === "result");
	const prompts = rows.filter((t) => t.kind === "prompt");

	return (
		<>
			<PanelSection title="Result" hint={`${results.length}`}>
				{results.length === 0 ? (
					<p className="text-base text-muted-foreground">
						None under this search.
					</p>
				) : (
					results.map((template) => (
						<TemplateRow
							key={template.id}
							template={template}
							active={template.id === selectedId}
							onClick={() => onSelect(template.id)}
							onPublish={() => publish.mutate(template.id)}
							onDelete={() => remove.mutate(template.id)}
						/>
					))
				)}
			</PanelSection>
			<PanelSection title="Prompt" hint={`${prompts.length}`}>
				{prompts.length === 0 ? (
					<p className="text-base text-muted-foreground">
						None yet. A prompt template is how a step asks a closed question —
						choice, yes/no, or a pick from the graph — so the answer is a value
						rather than a sentence.
					</p>
				) : (
					prompts.map((template) => (
						<TemplateRow
							key={template.id}
							template={template}
							active={template.id === selectedId}
							onClick={() => onSelect(template.id)}
							onPublish={() => publish.mutate(template.id)}
							onDelete={() => remove.mutate(template.id)}
						/>
					))
				)}
			</PanelSection>
		</>
	);
}

function TemplateRow({
	template,
	active,
	onClick,
	onPublish,
	onDelete,
}: {
	template: ProjectionTemplateRead;
	active?: boolean;
	onClick?: () => void;
	onPublish: () => void;
	onDelete: () => void;
}) {
	return (
		<WorkRow
			active={active}
			onClick={onClick}
			tone={template.status === "published" ? "info" : "muted"}
			title={
				<span className="flex items-center gap-1.5">
					{/* The surface leads the row on the artboard — it is what the
					    answer will look like, and the name is how it is referred to. */}
					<span className="shrink-0 bg-muted px-1.5 py-0.5 font-mono text-sm leading-none text-muted-foreground">
						{template.surface}
					</span>
					{template.name}
					{template.shipped ? (
						<span className="border border-border px-1.5 py-0.5 text-sm uppercase leading-none text-muted-foreground">
							shipped
						</span>
					) : null}
					{template.status === "draft" ? (
						<span className="border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-sm uppercase leading-none text-warning">
							draft
						</span>
					) : null}
				</span>
			}
			subtitle={
				<span className="truncate">
					{template.intent || "no intent stated"} · v{template.version} · used{" "}
					{template.used}×
				</span>
			}
			actions={
				template.shipped ? undefined : (
					<span className="flex items-center gap-1">
						{template.status === "draft" ? (
							<Button
								size="sm"
								variant="ghost"
								className="h-6 px-1.5 text-sm"
								onClick={onPublish}
							>
								Publish
							</Button>
						) : null}
						<Button
							size="sm"
							variant="ghost"
							className="h-6 px-1.5"
							onClick={onDelete}
							title="Remove — refused while answers still cite it"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					</span>
				)
			}
		/>
	);
}

/**
 * One template, read end to end — `&template=`, inside the drawer (G33).
 *
 * It is a **statement of fact**, not a disabled form: a published template is
 * read-only because an answer rendered with it must not change shape after the
 * fact, and a shipped one belongs to every Graph. The detail says which, and
 * offers the one action that applies.
 */
function TemplateDetail({
	template,
	onPublish,
	onDelete,
}: {
	template: ProjectionTemplateRead;
	onPublish: () => void;
	onDelete: () => void;
}) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="min-h-0 flex-1 overflow-y-auto">
				<DetailBlock
					className="mt-0"
					title={template.name}
					subtitle={template.intent || "no intent stated"}
				>
					<PropertyRow label="kind">{template.kind}</PropertyRow>
					<PropertyRow label="surface">{template.surface}</PropertyRow>
					<PropertyRow label="version">{`v${template.version}`}</PropertyRow>
					<PropertyRow label="status">
						<DetailStatus
							tone={template.status === "published" ? "info" : "warning"}
						>
							{template.status}
						</DetailStatus>
					</PropertyRow>
					<PropertyRow label="rendered">{`${template.used}×`}</PropertyRow>
					<PropertyRow label="owner">
						{template.shipped
							? "ships with Invana — every Graph"
							: "this Graph"}
					</PropertyRow>
				</DetailBlock>
				<PanelSection title="Accepts" hint="what it can render">
					{/* The shape it accepts is why selection can rank it against the
					    shipped templates — so it is stated, not hidden. */}
					<pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm text-muted-foreground">
						{JSON.stringify(template.accepts, null, 2)}
					</pre>
				</PanelSection>
			</div>
			{template.shipped ? null : (
				<CardFooter className="shrink-0 flex-wrap gap-2 border-t">
					{template.status === "draft" ? (
						<Button size="sm" onClick={onPublish}>
							Publish
						</Button>
					) : null}
					<span className="flex-1" />
					<Button
						size="sm"
						variant="ghost"
						onClick={onDelete}
						title="Remove — refused while answers still cite it"
					>
						<Trash2 className="mr-1.5 h-3.5 w-3.5" />
						Remove
					</Button>
				</CardFooter>
			)}
		</div>
	);
}

function TemplateForm({
	username,
	graphSlug,
	onDone,
}: {
	username: string;
	graphSlug: string;
	onDone: () => void;
}) {
	const [name, setName] = useState("");
	const [surface, setSurface] = useState<string>("table");
	const [intent, setIntent] = useState("");

	const create = useMutation({
		mutationFn: () =>
			projectionTemplatesApi.create(username, graphSlug, {
				name: name.trim(),
				kind: "result",
				surface,
				intent: intent.trim(),
				// The shape it accepts follows its surface — the same constraints the
				// shipped templates declare, so selection ranks them together.
				accepts:
					surface === "metric"
						? { result_type: "tabular", single_value: true }
						: surface === "chart"
							? { result_type: "tabular", categorical: true }
							: surface === "subgraph"
								? { result_type: "graph", min_rows: 0 }
								: { result_type: "tabular", min_rows: 1 },
			}),
		onSuccess: onDone,
	});

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
				<div>
					<Label>Name</Label>
					<Input
						value={name}
						onChange={(e: { target: { value: string } }) =>
							setName(e.target.value)
						}
						placeholder="top-movers"
					/>
				</div>
				<div>
					<Label>Surface</Label>
					<Select value={surface} onValueChange={setSurface}>
						<SelectTrigger>
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
				<div>
					<Label>Intent</Label>
					<Input
						value={intent}
						onChange={(e: { target: { value: string } }) =>
							setIntent(e.target.value)
						}
						placeholder="a shape across categories"
					/>
					<p className="mt-1 text-sm text-muted-foreground">
						What it is for, so `project` can select it the way `plan` selects a
						workflow.
					</p>
				</div>
			</div>
			<CardFooter className="shrink-0 flex-wrap gap-2 border-t">
				<Button
					size="sm"
					disabled={!name.trim() || create.isPending}
					onClick={() => create.mutate()}
				>
					Save as a draft
				</Button>
				<span className="flex-1" />
				<Button size="sm" variant="ghost" onClick={onDone}>
					Cancel
				</Button>
			</CardFooter>
		</div>
	);
}
