/**
 * A type's page — `model_type=<name>` on its model (the-model-page.md).
 *
 * It replaces the model's tabs with the type's own: **Properties · Indexes ·
 * Constraints · Mappings**, under a `Models › <model> › <type>` head that
 * carries the type's records and key, a `node type` / `edge type` chip and the
 * draft chip. While a draft is open each row deletes from the draft and *Add
 * property* · *Add index* · *Add constraint* open their forms; without one the
 * tabs read, with *Open a draft*. Everything staged here lands on the same
 * staged bar as the rest of the model.
 *
 * The version read is the draft while one is open, else the active one; the
 * page fetches it and `@invana/boards` draws. Model-level acts (Publish,
 * Discard, the breadcrumb) are answered by the page that owns them, through
 * `onAction`.
 */

import {
	type ActionContext,
	type ActionSpec,
	Board,
	type BoardSpec,
	type PanelSpec,
	type RowSpec,
} from "@invana/boards";
import {
	Button,
	EmptyState,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { ApiError, suppressActionToast } from "@invana-studio/core";
import { ActButton, ConfirmDialog } from "@invana-studio/shell";
import { BOARD_ICONS } from "@invana-studio/ui";
import { Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { EdgeTypeFormDialog } from "../model-editor/components/EdgeTypeFormDialog";
import { NodeTypeFormDialog } from "../model-editor/components/NodeTypeFormDialog";
import {
	mappingsAsCreate,
	PropertyFormDialog,
} from "../model-editor/components/PropertyFormDialog";
import { RuleFormDialog } from "../model-editor/components/RuleFormDialog";
import type { ModelEditCtx } from "../model-editor/types";
import {
	useDeleteConstraintMutation,
	useDeleteEdgeTypeMutation,
	useDeleteIndexMutation,
	useDeleteNodeTypeMutation,
	useDeletePropertyKeyMutation,
	useModelVersionQuery,
	useUpdateEdgeTypeMutation,
	useUpdateNodeTypeMutation,
} from "../queries";
import type {
	ConstraintResponse,
	GraphVersionResponse,
	IndexResponse,
	NodeTypeResponse,
	TypePropertyMappingResponse,
} from "../types";
import {
	MODELS_ACTIONS,
	type ModelsScope,
	readOnly,
	stagedBar,
	versionChips,
} from "./modelsPageSpec";
import { TYPE_TABS, type TypeTab } from "./useModelsView";

const ICONS = { ...BOARD_ICONS, plus: Plus };

const TYPE_ACTIONS = {
	tab: "type-tab",
	addProperty: "add-property",
	addIndex: "add-index",
	addConstraint: "add-constraint",
	openDraft: "open-draft",
	more: "type-more",
} as const;

const TAB_LABEL: Record<TypeTab, string> = {
	properties: "Properties",
	indexes: "Indexes",
	constraints: "Constraints",
	mappings: "Mappings",
};

const nf = new Intl.NumberFormat();
/** A constraint that names the type's key. */
const KEY_CONSTRAINTS = ["unique", "node_key", "relationship_unique"];

interface Props {
	username: string;
	graphSlug: string;
	scope: ModelsScope;
	typeName: string;
	tab: TypeTab;
	/** Growth's latest count per `node:<name>` · `edge:<name>`, when counted. */
	counts: ReadonlyMap<string, number | null>;
	canWrite: boolean;
	creatingDraft: boolean;
	onTab: (tab: TypeTab) => void;
	/** The type is gone (deleted from the draft) — back to the model's page. */
	onGone: () => void;
	/** Every act that is not the type's own: the crumbs, Publish, Discard. */
	onAction: (action: string, context?: ActionContext) => void;
}

export function TypePage({
	username,
	graphSlug,
	scope,
	typeName,
	tab,
	counts,
	canWrite,
	creatingDraft,
	onTab,
	onGone,
	onAction,
}: Props) {
	const { model, draft, active } = scope;
	const versionId = draft?.id ?? active?.id;
	const version = useModelVersionQuery(
		username,
		graphSlug,
		model.id,
		versionId,
	);
	const tree = version.data;
	const node = tree?.node_types.find((t) => t.name === typeName);
	const edge = node
		? undefined
		: tree?.edge_types.find((t) => t.name === typeName);
	const type = node ?? edge;

	const ctx: ModelEditCtx | undefined =
		draft && canWrite
			? { username, graphSlug, modelId: model.id, versionId: draft.id }
			: undefined;

	const updateNode = useUpdateNodeTypeMutation(username, graphSlug);
	const updateEdge = useUpdateEdgeTypeMutation(username, graphSlug);
	const deleteKey = useDeletePropertyKeyMutation(username, graphSlug);
	const deleteIndex = useDeleteIndexMutation(username, graphSlug);
	const deleteConstraint = useDeleteConstraintMutation(username, graphSlug);
	const deleteNode = useDeleteNodeTypeMutation(username, graphSlug);
	const deleteEdge = useDeleteEdgeTypeMutation(username, graphSlug);

	const [form, setForm] = useState<
		"property" | "index" | "constraint" | "edit" | null
	>(null);
	const [deletingType, setDeletingType] = useState(false);

	const constraints = (tree?.constraints ?? []).filter(
		(c) => c.target_label === typeName,
	);
	const indexes = (tree?.indexes ?? []).filter(
		(i) => i.target_label === typeName,
	);
	// The effective list carries inherited properties; a type that inherits
	// nothing may come back with it empty, so its own list stands in.
	const mappings = node
		? node.effective_property_mappings?.length
			? node.effective_property_mappings
			: node.property_mappings
		: (edge?.property_mappings ?? []);
	const key = constraints.find((c) =>
		KEY_CONSTRAINTS.includes(c.constraint_type),
	);

	const stagedNames = new Set(
		(draft ? (scope.staged?.changes ?? []) : [])
			.filter((c) => c.op !== "removed")
			.map((c) => c.name),
	);
	const isStaged = (name: string) =>
		stagedNames.has(name) || stagedNames.has(`${typeName}.${name}`);

	/** Take the property off this type's mappings; drop its definition if no other type maps it. */
	async function removeProperty(m: TypePropertyMappingResponse) {
		if (!ctx || !type || !tree) return;
		const own = node ? node.property_mappings : (edge?.property_mappings ?? []);
		const args = {
			modelId: ctx.modelId,
			versionId: ctx.versionId,
			typeId: type.id,
			data: {
				property_mappings: mappingsAsCreate(own.filter((x) => x.id !== m.id)),
			},
		};
		const mappedElsewhere = [...tree.node_types, ...tree.edge_types].some(
			(t) =>
				t.id !== type.id &&
				t.property_mappings.some(
					(x) => x.property_key.id === m.property_key.id,
				),
		);
		try {
			await suppressActionToast(async () => {
				if (node) await updateNode.mutateAsync(args);
				else await updateEdge.mutateAsync(args);
				if (!mappedElsewhere)
					await deleteKey.mutateAsync({
						modelId: ctx.modelId,
						versionId: ctx.versionId,
						keyId: m.property_key.id,
					});
			});
		} catch (err) {
			toast.error(
				err instanceof ApiError
					? err.message
					: "Failed to remove the property.",
			);
		}
	}

	const stage = async (run: () => Promise<unknown>, what: string) => {
		try {
			await suppressActionToast(run);
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : `Failed to ${what}.`);
		}
	};

	const removable = !!ctx;

	const actions: ActionSpec[] = draft
		? [
				{
					id: TYPE_ACTIONS.addProperty,
					label: "Add property",
					icon: "plus",
					variant: "outline",
				},
				{
					id: TYPE_ACTIONS.more,
					label: "More actions",
					icon: "more",
					menu: true,
					options: ["edit", "delete"],
					optionLabels: { edit: "Edit type", delete: "Delete type" },
				},
			]
		: [
				{
					id: TYPE_ACTIONS.openDraft,
					label: creatingDraft ? "Opening a draft…" : "Open a draft",
					variant: "outline",
					disabled: creatingDraft,
				},
			];

	const records = counts.get(`${node ? "node" : "edge"}:${typeName}`) ?? null;
	const description = [
		records != null ? `${nf.format(records)} records` : null,
		key ? `key ${key.properties.join(", ")}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	const tabRows = (id: TypeTab): RowSpec[] => {
		if (!tree) return [];
		if (id === "properties")
			return [
				panelRow({
					title: "Properties",
					aside: String(mappings.length),
					empty: "No properties defined.",
					heads: ["property", "type", "cardinality", "index", "constraint"],
					rows: mappings.map((m) => {
						const name = m.property_key.name;
						const idx = indexes
							.filter((i) => i.properties.includes(name))
							.map((i) => i.index_type);
						const con = constraints
							.filter((c) => c.properties.includes(name))
							.map((c) => c.constraint_type);
						return {
							id: m.id,
							cells: [
								<Mono key="n">
									{name}
									{isStaged(name) ? <Staged /> : null}
								</Mono>,
								m.property_key.type,
								m.property_key.value_cardinality.toLowerCase(),
								idx.join(", ") || "—",
								con.join(", ") || "—",
							],
							remove:
								removable && !m.inherited
									? {
											label: `Remove ${name}`,
											run: () => removeProperty(m),
										}
									: undefined,
						};
					}),
				}),
			];
		if (id === "indexes")
			return [
				panelRow({
					title: "Indexes",
					aside: String(indexes.length),
					empty: "No indexes defined.",
					heads: ["name", "type", "properties"],
					actions: removable
						? [
								{
									id: TYPE_ACTIONS.addIndex,
									label: "Add index",
									icon: "plus",
									variant: "outline",
								},
							]
						: undefined,
					rows: indexes.map((i: IndexResponse) => ({
						id: i.id,
						cells: [
							<Mono key="n">
								{i.name}
								{isStaged(i.name) ? <Staged /> : null}
							</Mono>,
							i.index_type,
							<Mono key="p">{i.properties.join(", ")}</Mono>,
						],
						remove: removable
							? {
									label: `Remove ${i.name}`,
									run: () =>
										stage(
											() =>
												deleteIndex.mutateAsync({
													modelId: model.id,
													versionId: draft?.id as string,
													indexId: i.id,
												}),
											"remove the index",
										),
								}
							: undefined,
					})),
				}),
			];
		if (id === "constraints")
			return [
				panelRow({
					title: "Constraints",
					aside: String(constraints.length),
					empty: "No constraints defined.",
					heads: ["name", "type", "properties"],
					actions: removable
						? [
								{
									id: TYPE_ACTIONS.addConstraint,
									label: "Add constraint",
									icon: "plus",
									variant: "outline",
								},
							]
						: undefined,
					rows: constraints.map((c: ConstraintResponse) => ({
						id: c.id,
						cells: [
							<Mono key="n">
								{c.name}
								{isStaged(c.name) ? <Staged /> : null}
							</Mono>,
							c.constraint_type,
							<Mono key="p">{c.properties.join(", ")}</Mono>,
						],
						remove: removable
							? {
									label: `Remove ${c.name}`,
									run: () =>
										stage(
											() =>
												deleteConstraint.mutateAsync({
													modelId: model.id,
													versionId: draft?.id as string,
													constraintId: c.id,
												}),
											"remove the constraint",
										),
								}
							: undefined,
					})),
				}),
			];
		return [
			panelRow({
				title: "Mappings",
				aside: String(mappings.length),
				empty: "No properties defined.",
				heads: ["property", "default", "inherited from", "validation"],
				rows: mappings.map((m) => ({
					id: m.id,
					cells: [
						<Mono key="n">{m.property_key.name}</Mono>,
						m.default_value ?? "—",
						m.inherited ? (inheritedFrom(node, m, tree) ?? "—") : "—",
						[...m.property_key.validation_rules, ...m.validation_rules]
							.map((r) => r.rule_type)
							.join(", ") || "—",
					],
				})),
			}),
		];
	};

	const tabLabel = (id: TypeTab) =>
		id === "properties"
			? `Properties · ${mappings.length}`
			: id === "indexes"
				? `Indexes · ${indexes.length}`
				: id === "constraints"
					? `Constraints · ${constraints.length}`
					: TAB_LABEL[id];

	const missing = !!tree && !type;
	const spec: BoardSpec = {
		title: typeName,
		header: {
			crumbs: ["Models", model.name, typeName],
			crumbActions: [
				MODELS_ACTIONS.allModels,
				MODELS_ACTIONS.openModel,
				undefined,
			],
			description: description || undefined,
			chips: [
				{ label: edge ? "edge type" : "node type", variant: "outline" },
				...versionChips(scope),
			],
			actions: type ? readOnly(actions, canWrite) : undefined,
		},
		staged: stagedBar(scope, canWrite),
		tabs: missing
			? undefined
			: TYPE_TABS.map((id) => ({
					id,
					label: tabLabel(id),
					rows: id === tab ? tabRows(id) : [],
				})),
		tab,
		tabAction: TYPE_ACTIONS.tab,
		rows: missing
			? [
					{
						panels: [
							{
								kind: "text",
								options: { text: "" },
								render: (
									<EmptyState
										className="py-10"
										title={`${model.name} has no type called ${typeName}`}
										description="It may have been removed in this version."
										actions={
											<Button
												variant="outline"
												onClick={() => onAction(MODELS_ACTIONS.openModel)}
											>
												Back to {model.name}
											</Button>
										}
									/>
								),
							},
						],
					},
				]
			: [],
	};

	const handle = (action: string, context?: ActionContext) => {
		switch (action) {
			case TYPE_ACTIONS.tab:
				if (context?.option) onTab(context.option as TypeTab);
				return;
			case TYPE_ACTIONS.addProperty:
				return setForm("property");
			case TYPE_ACTIONS.addIndex:
				return setForm("index");
			case TYPE_ACTIONS.addConstraint:
				return setForm("constraint");
			case TYPE_ACTIONS.openDraft:
				return onAction(MODELS_ACTIONS.edit);
			case TYPE_ACTIONS.more:
				if (context?.option === "edit") setForm("edit");
				if (context?.option === "delete") setDeletingType(true);
				return;
			default:
				return onAction(action, context);
		}
	};

	return (
		<>
			<Board
				className="min-h-0 flex-1"
				spec={spec}
				icons={ICONS}
				onAction={handle}
			/>
			{ctx && type ? (
				<>
					<PropertyFormDialog
						open={form === "property"}
						ctx={ctx}
						kind={node ? "node" : "edge"}
						typeId={type.id}
						mappings={
							node ? node.property_mappings : (edge?.property_mappings ?? [])
						}
						propertyKeys={tree?.property_keys ?? []}
						onClose={() => setForm(null)}
					/>
					<RuleFormDialog
						open={form === "index" || form === "constraint"}
						ctx={ctx}
						rule={form === "constraint" ? "constraint" : "index"}
						target={{ kind: node ? "node_type" : "edge_type", name: typeName }}
						properties={mappings.map((m) => m.property_key.name)}
						onClose={() => setForm(null)}
					/>
					{node ? (
						<NodeTypeFormDialog
							open={form === "edit"}
							ctx={ctx}
							nodeType={node}
							existingNodeTypes={tree?.node_types ?? []}
							onClose={() => setForm(null)}
						/>
					) : edge ? (
						<EdgeTypeFormDialog
							open={form === "edit"}
							ctx={ctx}
							edgeType={edge}
							existingNodeTypes={tree?.node_types ?? []}
							onClose={() => setForm(null)}
						/>
					) : null}
					{/* A delete is staged like anything else — the confirm says so. */}
					<ConfirmDialog
						open={deletingType}
						title={`Delete ${typeName}?`}
						description={
							"It is staged, not gone: the draft loses it, and it leaves the " +
							"published model when you publish. Discard the staged set to put it back."
						}
						confirmLabel="Stage the delete"
						destructive
						onOpenChange={setDeletingType}
						onConfirm={() => {
							const args = {
								modelId: ctx.modelId,
								versionId: ctx.versionId,
								typeId: type.id,
							};
							if (node) deleteNode.mutate(args);
							else deleteEdge.mutate(args);
							setDeletingType(false);
							onGone();
						}}
					/>
				</>
			) : null}
		</>
	);
}

/** Where a mapping the type inherits comes from — the first ancestor that declares it. */
function inheritedFrom(
	node: NodeTypeResponse | undefined,
	m: TypePropertyMappingResponse,
	tree: GraphVersionResponse,
): string | null {
	if (!node) return null;
	return (
		node.hierarchy
			.filter((name) => name !== node.name)
			.find((name) =>
				tree.node_types
					.find((t) => t.name === name)
					?.property_mappings.some(
						(x) => x.property_key.id === m.property_key.id,
					),
			) ?? null
	);
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Mono({ children }: { children: ReactNode }) {
	return <span className="font-mono">{children}</span>;
}

/** The chip that marks a row as not yet published. */
function Staged() {
	return <span className="ml-2 text-primary">+ staged</span>;
}

interface TableRowSpec {
	id: string;
	cells: ReactNode[];
	/** The row's delete, while a draft is open. */
	remove?: { label: string; run: () => void };
}

/** One panel holding a table whose rows can delete from the draft. */
function panelRow(opts: {
	title: string;
	aside: string;
	empty: string;
	heads: string[];
	rows: TableRowSpec[];
	actions?: ActionSpec[];
}): RowSpec {
	const deletes = opts.rows.some((r) => r.remove);
	const panel: PanelSpec = {
		kind: "text",
		title: opts.title,
		aside: opts.aside,
		actions: opts.actions,
		flush: true,
		options: { text: "" },
		render:
			opts.rows.length === 0 ? (
				<p className="px-3 py-6 text-muted-foreground">{opts.empty}</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							{opts.heads.map((h) => (
								<TableHead key={h} className="uppercase">
									{h}
								</TableHead>
							))}
							{deletes ? <TableHead className="w-10" /> : null}
						</TableRow>
					</TableHeader>
					<TableBody>
						{opts.rows.map((r) => (
							<TableRow key={r.id}>
								{r.cells.map((c, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
									<TableCell key={i}>{c}</TableCell>
								))}
								{deletes ? (
									<TableCell className="text-right">
										{r.remove ? (
											<ActButton
												area="model"
												variant="ghost"
												size="icon"
												aria-label={r.remove.label}
												title={r.remove.label}
												onClick={r.remove.run}
											>
												<Trash2 />
											</ActButton>
										) : null}
									</TableCell>
								) : null}
							</TableRow>
						))}
					</TableBody>
				</Table>
			),
	};
	return { panels: [panel] };
}
