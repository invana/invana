/**
 * The two cards the model page's header opens: the Publish confirm and the archive refusal. Both are composed from the kit —
 * `Dialog`, `DiffList`, `RefusalCard` — and carry only what a person reads
 * before they act.
 */

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DiffList,
	DiffRow,
	Eyebrow,
	RefusalCard,
	Spinner,
} from "@invana/ui";
import { Check } from "lucide-react";
import { useDraftProjectionQuery } from "@/pages/graphs-detail/features/models/queries";
import type {
	BindingStitch,
	StagedSet,
} from "@/pages/graphs-detail/features/models/types";

const OP: Record<string, "add" | "remove" | "change"> = {
	added: "add",
	removed: "remove",
	modified: "change",
};

/** Publishing asks, and says what it will write. */
export function PublishConfirm({
	open,
	username,
	graphSlug,
	modelId,
	modelName,
	version,
	active,
	staged,
	connector,
	publishing,
	onPublish,
	onClose,
}: {
	open: boolean;
	username: string;
	graphSlug: string;
	modelId: string;
	modelName: string;
	/** The version the draft becomes — `2`. */
	version: string | null;
	/** The version that stays readable — `1`, or null when this is the first. */
	active: string | null;
	staged: StagedSet | null;
	connector: string;
	publishing: boolean;
	onPublish: () => void;
	onClose: () => void;
}) {
	const projection = useDraftProjectionQuery(
		username,
		graphSlug,
		modelId,
		open,
	);
	const ops = projection.data?.operations ?? [];
	const count = staged?.count ?? 0;
	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>
						Publish {modelName}
						{version ? ` v${version}` : ""}
					</DialogTitle>
					<DialogDescription>
						{count} {count === 1 ? "change becomes" : "changes become"}{" "}
						{version ? `v${version}` : "the next version"}.
						{active
							? ` v${active} stays readable for everything that used it.`
							: ""}
					</DialogDescription>
				</DialogHeader>
				<DiffList>
					{(staged?.changes ?? []).map((c) => (
						<DiffRow key={c.id} op={OP[c.op]} kind={c.kind.replace("_", " ")}>
							<span className="font-mono">{c.name}</span>
						</DiffRow>
					))}
				</DiffList>
				<Eyebrow>What it asks {connector} to hold</Eyebrow>
				{projection.isLoading ? (
					<Spinner />
				) : projection.isError ? (
					<p className="text-sm text-muted-foreground">
						The projection could not be read — publishing still records the
						version.
					</p>
				) : ops.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No index or constraint to create — this version writes nothing to
						the database.
					</p>
				) : (
					<DiffList>
						{ops.map((op) => (
							<DiffRow
								key={op.name}
								op="add"
								kind={op.supported ? undefined : "unsupported"}
							>
								<span className="font-mono">{op.statement}</span>
							</DiffRow>
						))}
					</DiffList>
				)}
				<p className="text-sm text-muted-foreground">
					{projection.data?.against === "live"
						? "Read against what the database holds now. "
						: "Read against the published version — this connector does not list its indexes. "}
					No data is rewritten.
				</p>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={onPublish}
						disabled={publishing || !staged?.can_commit}
					>
						<Check /> Publish{version ? ` v${version}` : ""}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Archive refused, naming each active stitch that binds the model. */
export function ArchiveRefused({
	modelName,
	stitches,
	onOpenStitches,
	onClose,
}: {
	modelName: string | null;
	stitches: BindingStitch[];
	onOpenStitches: () => void;
	onClose: () => void;
}) {
	return (
		<Dialog open={modelName !== null} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Archive {modelName}</DialogTitle>
				</DialogHeader>
				<RefusalCard
					label={`refused · ${stitches.length} active ${stitches.length === 1 ? "stitch" : "stitches"}`}
					remedy="Remove them first, or archive the models on their other side too."
				>
					{modelName} can’t be archived while these bind it. An archived model
					leaves the global model, and they would link to nothing.
				</RefusalCard>
				<DiffList>
					{stitches.map((s) => (
						<DiffRow key={s.id} op={s.kind} kind={s.kind}>
							<span className="font-mono">
								{s.source} {s.kind === "anchor" ? "≡" : "→"} {s.target}
							</span>
						</DiffRow>
					))}
				</DiffList>
				<DialogFooter>
					<Button variant="ghost" onClick={onOpenStitches}>
						Open the stitches
					</Button>
					<Button variant="outline" onClick={onClose}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
