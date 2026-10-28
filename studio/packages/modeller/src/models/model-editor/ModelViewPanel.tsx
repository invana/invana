/**
 * One model's outline — the leftSection of its page (the-model-page.md).
 *
 * There is no models list here: a model is picked from the models board's rows,
 * the global canvas or a breadcrumb, and this panel exists only while one is
 * open (`?model=`). It is one head — the model and the version read — over
 * **Node types · Edge types · Stitches** in one scrolling list, one line a row, and
 * nothing acts on the model itself: `Open in Schema`, `Publish`, `Rename`,
 * `Export` and `Archive` are on the page header, because they act on what the
 * page shows. Picking a type opens that type's page.
 *
 * ```
 * AIRROUTES                                          v1.0.1 · active
 * NODE TYPES  4                                                + add
 *   ● airport                                             14 props
 * EDGE TYPES  2                                                + add
 *   ● route                                      airport → airport
 * STITCHES  3
 *   ● country ≡ NewsArticles.Country                        anchor
 * ```
 *
 * Scope and panel are one state, and it is the URL's (`useModelsView`).
 */

import {
	Badge,
	NavHorizontalItems,
	type PanelStackSection,
	SectionHeader,
} from "@invana/ui";
import { gateItem, useAccess } from "@invana-studio/shell";
import { SectionTitle } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useModelsView } from "../model-page/useModelsView";
import {
	useModelsQuery,
	useModelVersionQuery,
	useModelVersionsQuery,
	useStagedSetQuery,
} from "../queries";
import { useStitchesSection } from "../stitch/useStitchesSection";
import type { GraphModelSummary } from "../types";
import { EdgeTypeFormDialog } from "./components/EdgeTypeFormDialog";
import { NodeTypeFormDialog } from "./components/NodeTypeFormDialog";
import { OutlineRow } from "./components/OutlineRow";
import type { ModelEditCtx, ModelSelection } from "./types";

interface Props {
	username: string;
	graphSlug: string;
	/** The type the page has open — the sections light it. */
	selection: ModelSelection | null;
	onSelect: (selection: ModelSelection | null) => void;
	/**
	 * Bring the model page forward — a type picked here reads there. It returns
	 * the URL keys that name the page, written with the type in one update.
	 */
	onShowPage: () => Record<string, string | null>;
	/** Membership is binary today, so every member writes. */
	canWrite?: boolean;
}

export function ModelViewPanel({
	username,
	graphSlug,
	selection,
	onSelect,
	onShowPage,
	canWrite = true,
}: Props) {
	const { view, set } = useModelsView();
	const models = useModelsQuery(username, graphSlug);
	const scoped =
		(models.data ?? []).find(
			(m) =>
				m.id === view.scope &&
				m.origin !== "introspected" &&
				m.status !== "archived",
		) ?? null;
	if (!scoped || !view.open) return null;

	return (
		<ModelOutline
			key={scoped.id}
			username={username}
			graphSlug={graphSlug}
			model={scoped}
			selection={selection}
			onSelect={(next) => {
				onSelect(next);
				// A type opens as a page of its model, not under the canvas.
				if (next) set({ type: next.name, schema: false }, onShowPage());
			}}
			canWrite={canWrite}
		/>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// One model: its three sections
// ─────────────────────────────────────────────────────────────────────────────

function ModelOutline({
	username,
	graphSlug,
	model,
	selection,
	onSelect,
	canWrite,
}: {
	username: string;
	graphSlug: string;
	model: GraphModelSummary;
	selection: ModelSelection | null;
	onSelect: (selection: ModelSelection | null) => void;
	canWrite: boolean;
}) {
	const versions = useModelVersionsQuery(username, graphSlug, model.id);
	const list = versions.data ?? [];
	const draft = list.find((v) => v.status === "draft") ?? null;
	const active = list.find((v) => v.status === "active") ?? null;
	const openVersionId = draft?.id ?? active?.id ?? null;
	const version = useModelVersionQuery(
		username,
		graphSlug,
		model.id,
		openVersionId ?? undefined,
	);
	const staged = useStagedSetQuery(username, graphSlug, model.id, !!draft);
	const modelGate = useAccess().gate("model");

	// Adding is authoring, and authoring is on a draft: `+ add` is on the
	// two type sections while one is open, and `Edit` on the page opens one.
	const ctx: ModelEditCtx | undefined =
		draft && canWrite
			? { username, graphSlug, modelId: model.id, versionId: draft.id }
			: undefined;
	const [adding, setAdding] = useState<"node" | "edge" | null>(null);

	const stagedNames = new Set(
		(draft ? (staged.data?.changes ?? []) : [])
			.filter((c) => c.op !== "removed")
			.map((c) => `${c.kind}:${c.name}`),
	);
	const tree = version.data;
	const nodeTypes = sortStagedFirst(
		tree?.node_types ?? [],
		stagedNames,
		"node_type",
	);
	const edgeTypes = sortStagedFirst(
		tree?.edge_types ?? [],
		stagedNames,
		"edge_type",
	);

	// Stitch hands the model a section and a dialog; the model places both
	// (stitch-models.md). One direction — `model → stitch`, never back.
	const { section: stitchesSection, dialog: stitchesDialog } =
		useStitchesSection({
			username,
			graphSlug,
			versionId: active?.id ?? null,
			selection,
		});

	const sections: PanelStackSection[] = [
		{
			id: "node-types",
			title: <SectionTitle count={nodeTypes.length}>Node types</SectionTitle>,
			headerActions: ctx
				? [
						gateItem(
							{
								key: "add",
								name: "Add a node type",
								icon: Plus,
								onClick: () => setAdding("node"),
							},
							modelGate,
						),
					]
				: [],
			actionsOnHover: false,
			content: (
				<div className="pb-2.5">
					{nodeTypes.length === 0 ? (
						<p className="px-3 text-base text-muted-foreground">
							Nothing modelled yet.
						</p>
					) : (
						nodeTypes.map((nt) => (
							<TypeRow
								key={nt.id}
								name={nt.name}
								staged={stagedNames.has(`node_type:${nt.name}`)}
								detail={`${nt.property_mappings?.length ?? 0} props`}
								active={
									selection?.kind === "node_type" && selection.name === nt.name
								}
								onClick={() => onSelect({ kind: "node_type", name: nt.name })}
							/>
						))
					)}
				</div>
			),
		},
		{
			id: "edge-types",
			title: <SectionTitle count={edgeTypes.length}>Edge types</SectionTitle>,
			headerActions: ctx
				? [
						gateItem(
							{
								key: "add",
								name: "Declare an edge type",
								icon: Plus,
								onClick: () => setAdding("edge"),
							},
							modelGate,
						),
					]
				: [],
			actionsOnHover: false,
			content: (
				<div className="pb-2.5">
					{edgeTypes.length === 0 ? (
						<p className="px-3 text-base text-muted-foreground">
							No edge types.
						</p>
					) : (
						edgeTypes.map((et) => (
							<TypeRow
								key={et.id}
								name={et.name}
								staged={stagedNames.has(`edge_type:${et.name}`)}
								detail={`${(et.source_node_types ?? []).join(" · ") || "—"} → ${
									(et.target_node_types ?? []).join(" · ") || "—"
								}`}
								active={
									selection?.kind === "edge_type" && selection.name === et.name
								}
								onClick={() => onSelect({ kind: "edge_type", name: et.name })}
							/>
						))
					)}
				</div>
			),
		},
		stitchesSection,
	];

	// The version read, then the draft's staged count when there is one — the
	// head says what the outline below is the outline of.
	const versionLine = [
		active ? `v${active.version} · active` : "never published",
		...(draft
			? [
					`${draft.version ? `v${draft.version} ` : ""}draft · ${staged.data?.count ?? 0} staged`,
				]
			: []),
	].join(" · ");

	return (
		<div className="flex h-full min-h-0 flex-col">
			<SectionHeader title={model.name} count={versionLine} />
			{/* One list read down, as the board draws it — not a resizable stack,
			    which split the column evenly and left two short lists half empty. */}
			<div className="min-h-0 flex-1 overflow-y-auto">
				{sections.map((section) => (
					<section key={section.id}>
						<SectionHeader
							bare
							title={section.title}
							actions={
								section.headerActions?.length ? (
									<NavHorizontalItems items={section.headerActions} />
								) : undefined
							}
						/>
						{section.content}
					</section>
				))}
			</div>
			{ctx ? (
				<>
					<NodeTypeFormDialog
						open={adding === "node"}
						ctx={ctx}
						nodeType={null}
						existingNodeTypes={tree?.node_types ?? []}
						onClose={() => setAdding(null)}
					/>
					<EdgeTypeFormDialog
						open={adding === "edge"}
						ctx={ctx}
						edgeType={null}
						existingNodeTypes={tree?.node_types ?? []}
						onClose={() => setAdding(null)}
					/>
				</>
			) : null}
			{stitchesDialog}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────────────

function TypeRow({
	name,
	staged,
	detail,
	active,
	onClick,
}: {
	name: string;
	staged: boolean;
	detail: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<OutlineRow
			name={name}
			meta={detail}
			tone={staged ? "info" : "muted"}
			chip={
				staged ? (
					<Badge variant="soft" tone="info" size="xs">
						staged
					</Badge>
				) : null
			}
			active={active}
			onClick={onClick}
		/>
	);
}

interface NamedType {
	id: string;
	name: string;
	property_mappings?: unknown[];
}

/** — staged rows sort first, then the rest alphabetically. */
function sortStagedFirst<T extends NamedType>(
	types: T[],
	stagedNames: Set<string>,
	kind: "node_type" | "edge_type",
): T[] {
	return [...types].sort((a, b) => {
		const aStaged = stagedNames.has(`${kind}:${a.name}`) ? 0 : 1;
		const bStaged = stagedNames.has(`${kind}:${b.name}`) ? 0 : 1;
		return aStaged - bStaged || a.name.localeCompare(b.name);
	});
}
