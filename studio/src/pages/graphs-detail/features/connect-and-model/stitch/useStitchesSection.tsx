import {
	useCommitStitchesMutation,
	useDiscardStitchesMutation,
	useModelLinksQuery,
	useModelsQuery,
	useRemoveLinkMutation,
} from "@/hooks/queries/useModels";
import type { ModelSelection } from "@/pages/graphs-detail/features/connect-and-model/model/types";
import {
	stitchPair,
	stitchRule,
} from "@/pages/graphs-detail/features/connect-and-model/stitch/allModels";
import { DeclareStitchDialog } from "@/pages/graphs-detail/features/connect-and-model/stitch/components/DeclareStitchDialog";
import { RemoveStitchDialog } from "@/pages/graphs-detail/features/connect-and-model/stitch/components/RemoveStitchDialog";
import { SectionTitle } from "@/pages/graphs-detail/shared/SectionTitle";
import { WorkRow } from "@/pages/graphs-detail/shared/WorkRow";
import type { LinkKind, ModelLink } from "@/types/models";
import { Button, type PanelStackSection } from "@invana/ui";
import { Check, Link2, Plus, Trash2, Undo2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Scrolls its row into view the moment it becomes the marked one.
 *
 * A refusal that says *open the existing stitch* has to land on that stitch. The
 * list is a scroller, and the row it names is often below the fold.
 */
function HighlightOnMount({
	on,
	children,
}: {
	on: boolean;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (on) ref.current?.scrollIntoView({ block: "center" });
	}, [on]);
	return <div ref={ref}>{children}</div>;
}

/**
 * One model's stitches, as a drawer in the Model panel's stack, and the dialog
 * that declares another (stitch-models.md ST12).
 *
 * The surface is **Stitches**; the record is a link (ST13). A person stitches
 * two models together, and `model_links` is what the engine stores once they
 * have — so the drawer, its header and its copy say stitch, while the wire
 * format, the routes and the events keep saying link.
 *
 * A link joins **two** models, so this lists every link that touches the one on
 * screen — from either side — rather than pretending the model owns them (ST10).
 * What the model *does* own is the starting point: `add` is offered only while
 * a node type is selected, and the dialog opens with that type already filled in
 * as the source (ST1 — declared, never inferred, and never re-asked).
 *
 * **Both kinds are declared from here** (ST11), and from one control. `add`
 * opens the declare card, which carries the kind as a segmented control of its
 * own — *Anchor — same entity* or *Relationship*. A menu that asked for the kind
 * first made a person choose between two words before seeing the two types the
 * stitch is about; inside the card the choice can be changed after seeing them.
 *
 * Returned rather than rendered, because a `PanelStack` section is data. The
 * model places `section` in its stack and `dialog` beside it; stitch keeps the
 * declare state, so the seam stays one-way (`model → stitch`).
 */
export function useStitchesSection({
	username,
	graphSlug,
	versionId,
	selection,
	onOpenGlobalModel,
	scope = "model",
}: {
	username: string;
	graphSlug: string;
	/** The published version whose types can be linked. Drafts cannot (ST8). */
	versionId: string | null;
	selection: ModelSelection | null;
	onOpenGlobalModel?: () => void;
	/**
	 * `model` (the default) lists the stitches touching `versionId` — one
	 * model's view of them. `graph` lists every stitch in the Graph, which is
	 * what the *All models* panel wants: there is no model selected there, and
	 * the staged set is the Graph's anyway (ST21, ST22).
	 */
	scope?: "model" | "graph";
}): {
	section: PanelStackSection;
	dialog: ReactNode;
	/** Opens the declare card from outside the drawer — the panel's own strip. */
	declare: () => void;
} {
	const [declaring, setDeclaring] = useState<LinkKind | null>(null);
	// The stitch a refusal pointed at — marked in the list and scrolled to, so
	// "Open the existing stitch" lands somewhere rather than only closing a card.
	const [highlighted, setHighlighted] = useState<string | null>(null);
	// Removing is immediate once confirmed — a stitch being withdrawn has
	// nothing to preview — so the confirm is where the consequence is stated.
	const [removing, setRemoving] = useState<ModelLink | null>(null);
	const links = useModelLinksQuery(username, graphSlug);
	// A relationship whose rows are their own fact says *whose* records ship
	// them — "rows that ship with its records" names nothing anybody can go and
	// look at.
	const models = useModelsQuery(username, graphSlug);
	const sourceModelName = (link: ModelLink) =>
		(models.data ?? []).find((m) => m.id === link.source_model_id)?.name;
	const remove = useRemoveLinkMutation(username, graphSlug);
	const commit = useCommitStitchesMutation(username, graphSlug);
	const discard = useDiscardStitchesMutation(username, graphSlug);

	// Both directions. `Article ≡ Stock` is the same fact whether you are looking
	// at the news model or the market one (ST10).
	const touching =
		scope === "graph"
			? (links.data ?? [])
			: (links.data ?? []).filter(
					(l: ModelLink) =>
						l.source_version_id === versionId ||
						l.target_version_id === versionId,
				);
	// Staged first, as every type list already sorts them (model-editor.md ME5):
	// what is about to land reads before what already has.
	const mine = [
		...touching.filter((l) => l.status === "staged"),
		...touching.filter((l) => l.status !== "staged"),
	];
	// The staged set is the Graph's, not this model's — committing flips every
	// staged stitch in one action (ST21), so the count that drives the control
	// is the whole set rather than the slice on screen.
	const stagedCount = (links.data ?? []).filter(
		(l: ModelLink) => l.status === "staged",
	).length;

	// A selection prefills the source; it is not what makes declaring possible.
	// The dialog asks for both ends, so the only real precondition is that this
	// Graph has something published to bind to (ST8).
	const hasPublished =
		scope === "graph" ? (links.data ?? []).length > 0 || true : !!versionId;
	const prefilled =
		!!versionId && selection?.kind === "node_type" && !!selection.name;
	const canDeclare = hasPublished;
	const sourceKey = prefilled ? `${versionId}::${selection.name}` : undefined;

	const section: PanelStackSection = {
		id: "stitches",
		icon: Link2,
		title: <SectionTitle count={mine.length}>Stitches</SectionTitle>,
		headerActions: [
			...(stagedCount > 0
				? [
						{
							key: "commit",
							name: `Commit ${stagedCount} staged ${stagedCount === 1 ? "stitch" : "stitches"} — the union spans them from then on`,
							icon: Check,
							onClick: () => commit.mutate(undefined as never),
						},
						{
							key: "discard",
							name: "Discard the staged stitches — they were never in the union, so nothing is put back",
							icon: Undo2,
							onClick: () => discard.mutate(undefined),
						},
					]
				: []),
			// One control, one word. The kind is a segmented control *inside* the
			// card (ST11), so a person picks between two types they can see rather
			// than between two words in a menu.
			...(canDeclare
				? [
						{
							key: "declare",
							name: prefilled
								? `Declare a stitch from ${selection?.name} to a type in another model`
								: "Declare a stitch between two published models",
							icon: Plus,
							onClick: () => setDeclaring("anchor"),
						},
					]
				: []),
		],
		content: (
			<div className="px-3 pb-2.5">
				{mine.length === 0 ? (
					<div className="flex flex-col items-start gap-2">
						<p className="text-sm text-muted-foreground">
							{!versionId && scope !== "graph"
								? "A stitch binds published versions. Publish this model first (ST8)."
								: prefilled
									? `No stitches. ${selection?.name} can be anchored to a type in another published model — both nodes stay, nothing merges — or given an edge type to one, on a key each side.`
									: "No stitches. Two models meet only where somebody says they meet — pick a type on each side, and the count of what resolves comes back before anything is declared."}
						</p>
						{canDeclare ? (
							<Button
								size="xs"
								variant="outline"
								onClick={() => setDeclaring("anchor")}
							>
								<Plus />
								Declare a stitch
							</Button>
						) : null}
					</div>
				) : (
					mine.map((link: ModelLink) => (
						<HighlightOnMount key={link.id} on={link.id === highlighted}>
							<WorkRow
								active={link.id === highlighted}
								tone={
									link.status === "staged"
										? "warning"
										: link.kind === "anchor"
											? "info"
											: "muted"
								}
								title={stitchPair(link)}
								// The rule, then the state — `Company.ticker =
								// Stock.nse_symbol · exact · active`. The row says what the
								// stitch resolves on, because that is the thing anyone
								// reviewing it has to judge.
								// The rule, the state, and — when something other than
								// this drawer declared it — where it came from, so a
								// stitch applied from a bundle on the command line is
								// not an anonymous row nobody remembers making (ST50).
								subtitle={`${stitchRule(link, sourceModelName(link))} · ${
									link.status === "staged"
										? "staged · not in the union yet"
										: "active"
								}${link.description ? ` · ${link.description}` : ""}`}
								status={link.status === "staged" ? "staged" : link.kind}
								actions={
									<Button
										variant="ghost"
										size="icon-xs"
										title="Remove this stitch — the union stops spanning that pair"
										onClick={() => setRemoving(link)}
									>
										<Trash2 />
									</Button>
								}
							/>
						</HighlightOnMount>
					))
				)}
				{onOpenGlobalModel ? (
					<button
						type="button"
						onClick={onOpenGlobalModel}
						className="mt-1 text-meta text-primary hover:underline"
					>
						Open the global model
					</button>
				) : null}
			</div>
		),
	};

	const dialog = (
		<>
			<RemoveStitchDialog
				link={removing}
				sourceModel={removing ? sourceModelName(removing) : undefined}
				onConfirm={(link) => {
					remove.mutate(link.id);
					setRemoving(null);
				}}
				onOpenChange={(open) => {
					if (!open) setRemoving(null);
				}}
			/>
			<DeclareStitchDialog
				kind={declaring}
				username={username}
				graphSlug={graphSlug}
				sourceKey={sourceKey}
				onOpenStitch={(linkId) => {
					setHighlighted(linkId);
					setDeclaring(null);
				}}
				onClose={() => setDeclaring(null)}
			/>
		</>
	);

	return { section, dialog, declare: () => setDeclaring("anchor") };
}
