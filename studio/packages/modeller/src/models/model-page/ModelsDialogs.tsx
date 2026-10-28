/**
 * The two cards the model page's header opens: the Publish confirm and the
 * archive refusal. Both are composed from the kit — `Dialog`, `DiffList`,
 * `RefusalCard` — and carry only what a person reads before they act.
 *
 * The Publish confirm asks the engine first (`GET …/draft/review`):
 *
 * | Draft | The confirm |
 * |---|---|
 * | additive | the staged changes, what the database is asked to hold, who reads the model, *Publish vN* |
 * | breaking | *— breaking*, each breaking change with its reason, who reads it, a why, *Request approval* |
 * | review requested | the review as it moves: the preview run, then the migration table, then *waiting on approval* |
 *
 * Who reads a model is the stitches on it and the datasets bound into it —
 * runs do not pin model versions, so a run is not a reader.
 */

import { Label, Textarea } from "@invana/forms";
import {
	Alert,
	Badge,
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { ApiError } from "@invana-studio/core";
import { approvalsPath, runPagePath } from "@invana-studio/shell";
import { Check } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
	useDatasetBindingsQuery,
	useDraftProjectionQuery,
	useDraftReviewQuery,
	useModelLinksQuery,
	usePublishMutation,
	usePublishReviewQuery,
} from "../queries";
import type {
	BindingStitch,
	PublishChange,
	PublishReview,
	StagedSet,
} from "../types";

/** A change's sign, from what it did: `*_added`, `*_removed`, or the rest. */
const opOf = (c: PublishChange): "add" | "remove" | "change" =>
	c.kind.endsWith("_added")
		? "add"
		: c.kind.endsWith("_removed")
			? "remove"
			: "change";

/** `Variety.wilt` — where a change lands, as the model names it. */
const where = (c: PublishChange) =>
	[c.type, c.property].filter(Boolean).join(".") || c.kind;

/**
 * A type's property and the key it reads are one change to a reader:
 * `airport.region` removed already says `region` went, so the bare key drops out.
 */
function collapse(changes: PublishChange[]): PublishChange[] {
	const onType = new Set(
		changes
			.filter((c) => c.type && c.property)
			.map((c) => `${c.property}:${c.breaking}`),
	);
	return changes.filter(
		(c) =>
			!(
				c.target_kind === "property_key" &&
				!c.type &&
				onType.has(`${c.property}:${c.breaking}`)
			),
	);
}

/** The engine's refusal, in its own words. */
function refusalOf(err: unknown): string {
	if (err instanceof ApiError) {
		const d = err.detail as { message?: string } | string | undefined;
		if (typeof d === "string") return d;
		if (d?.message) return d.message;
	}
	return err instanceof Error ? err.message : "The publish was refused.";
}

const REVIEW_LINE: Record<PublishReview["status"], string> = {
	previewing:
		"Previewing the migration — the preview run reads what the change touches. Nobody is asked yet.",
	pending:
		"Waiting on approval from another owner, in Activity › Approvals. The migration runs after approval.",
	migrating: "Approved — the migration run is publishing it now.",
	published: "Published.",
	failed: "The review failed; nothing was published.",
	declined: "Declined; nothing was published.",
	expired: "Nobody decided before the deadline; nothing was published.",
	stale: "The draft or the published version moved; nothing was published.",
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
	const review = useDraftReviewQuery(username, graphSlug, modelId, open);
	const [reviewId, setReviewId] = useState<string | null>(null);
	const close = () => {
		setReviewId(null);
		onClose();
	};
	const breaking = review.data?.classification === "breaking";

	return (
		<Dialog open={open} onOpenChange={(o) => !o && close()}>
			<DialogContent className="max-w-xl">
				{review.isLoading ? (
					<>
						<DialogHeader>
							<DialogTitle>Publish {modelName}</DialogTitle>
							<DialogDescription>
								Reading whether the change adds or breaks…
							</DialogDescription>
						</DialogHeader>
						<Spinner />
					</>
				) : reviewId ? (
					<ReviewState
						username={username}
						graphSlug={graphSlug}
						modelId={modelId}
						modelName={modelName}
						reviewId={reviewId}
						onClose={close}
					/>
				) : breaking ? (
					<BreakingConfirm
						username={username}
						graphSlug={graphSlug}
						modelId={modelId}
						modelName={modelName}
						version={version}
						changes={review.data?.changes ?? []}
						onRequested={setReviewId}
						onClose={close}
					/>
				) : (
					<AdditiveConfirm
						username={username}
						graphSlug={graphSlug}
						modelId={modelId}
						modelName={modelName}
						version={version}
						active={active}
						staged={staged}
						changes={review.data?.changes ?? []}
						connector={connector}
						publishing={publishing}
						onPublish={onPublish}
						onClose={close}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function AdditiveConfirm({
	username,
	graphSlug,
	modelId,
	modelName,
	version,
	active,
	staged,
	changes,
	connector,
	publishing,
	onPublish,
	onClose,
}: {
	username: string;
	graphSlug: string;
	modelId: string;
	modelName: string;
	version: string | null;
	active: string | null;
	staged: StagedSet | null;
	/** What the engine says the draft does, against the published version. */
	changes: PublishChange[];
	connector: string;
	publishing: boolean;
	onPublish: () => void;
	onClose: () => void;
}) {
	const projection = useDraftProjectionQuery(username, graphSlug, modelId);
	const ops = projection.data?.operations ?? [];
	const rows = collapse(changes);
	const count = rows.length;
	return (
		<>
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
				{rows.map((c) => (
					<DiffRow key={`${c.kind}-${where(c)}`} op={opOf(c)}>
						<span className="font-mono">{where(c)}</span>
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
					No index or constraint to create — this version writes nothing to the
					database.
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
			<WhoReads
				username={username}
				graphSlug={graphSlug}
				modelId={modelId}
				modelName={modelName}
				after={
					active ? "None of them break: the change only adds and widens." : null
				}
			/>
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
		</>
	);
}

function BreakingConfirm({
	username,
	graphSlug,
	modelId,
	modelName,
	version,
	changes,
	onRequested,
	onClose,
}: {
	username: string;
	graphSlug: string;
	modelId: string;
	modelName: string;
	version: string | null;
	changes: PublishChange[];
	onRequested: (reviewId: string) => void;
	onClose: () => void;
}) {
	const [why, setWhy] = useState("");
	const publish = usePublishMutation(username, graphSlug);
	const rows = collapse(changes);
	const broken = rows.filter((c) => c.breaking);
	return (
		<>
			<DialogHeader>
				<DialogTitle>
					Publish {modelName}
					{version ? ` v${version}` : ""} — breaking
				</DialogTitle>
				<DialogDescription>needs approval from another owner</DialogDescription>
			</DialogHeader>
			<Alert tone="warning">
				<span className="font-semibold">Breaking: </span>
				{broken.map((c, i) => (
					<span key={`${c.kind}-${where(c)}`}>
						{i > 0 ? "; " : ""}
						<span className="font-mono">{where(c)}</span> {c.reason}
					</span>
				))}
				.
			</Alert>
			<Eyebrow>Migration run</Eyebrow>
			<Table bordered={false} density="compact">
				<TableHeader>
					<TableRow>
						<TableHead>Change</TableHead>
						<TableHead>Where</TableHead>
						<TableHead>Outcome</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((c) => (
						<TableRow key={`${c.kind}-${where(c)}`}>
							<TableCell>{c.kind.replaceAll("_", " ")}</TableCell>
							<TableCell className="font-mono">{where(c)}</TableCell>
							{/* The records a change touches arrive with the preview run. */}
							<TableCell
								className={
									c.breaking ? "text-muted-foreground" : "text-success"
								}
							>
								{c.breaking ? "counted after you request approval" : "additive"}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<WhoReads
				username={username}
				graphSlug={graphSlug}
				modelId={modelId}
				modelName={modelName}
				after={null}
			/>
			<div className="space-y-1.5">
				<Label htmlFor="publish-why">Why</Label>
				<Textarea
					id="publish-why"
					value={why}
					maxLength={500}
					onChange={(e) => setWhy(e.target.value)}
					placeholder="What the approver should know"
				/>
			</div>
			{publish.isError ? (
				<RefusalCard label="refused">{refusalOf(publish.error)}</RefusalCard>
			) : null}
			<p className="text-sm text-muted-foreground">
				A preview run counts the records each change touches before anyone is
				asked. The migration runs after approval, as a run you can watch;
				nothing changes before.
			</p>
			<DialogFooter>
				<Button variant="ghost" onClick={onClose}>
					Cancel
				</Button>
				<Button
					disabled={publish.isPending}
					onClick={() =>
						publish.mutate(
							{ modelId, why: why.trim() },
							{
								onSuccess: (res) => {
									const review = res.review;
									if (review) onRequested(review.id);
									else onClose();
								},
							},
						)
					}
				>
					Request approval
				</Button>
			</DialogFooter>
		</>
	);
}

/** A requested review, read until its preview lands. */
function ReviewState({
	username,
	graphSlug,
	modelId,
	modelName,
	reviewId,
	onClose,
}: {
	username: string;
	graphSlug: string;
	modelId: string;
	modelName: string;
	reviewId: string;
	onClose: () => void;
}) {
	const review = usePublishReviewQuery(username, graphSlug, modelId, reviewId);
	const r = review.data;
	const runsPath = (runId: string) =>
		runPagePath({ username, graphSlug }, runId);
	return (
		<>
			<DialogHeader>
				<DialogTitle>Publish {modelName} — review requested</DialogTitle>
				<DialogDescription>
					{r ? r.status : "reading the review…"}
				</DialogDescription>
			</DialogHeader>
			{!r ? (
				<Spinner />
			) : (
				<>
					<p>{r.reason ?? REVIEW_LINE[r.status]}</p>
					{r.preview ? (
						<>
							<Eyebrow>Migration run</Eyebrow>
							<Table bordered={false} density="compact">
								<TableHeader>
									<TableRow>
										<TableHead>Type</TableHead>
										<TableHead>Records</TableHead>
										<TableHead>Affected</TableHead>
										<TableHead>Would fail</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{r.preview.types.map((t) => (
										<TableRow key={`${t.kind}-${t.type}`}>
											<TableCell className="font-mono">{t.type}</TableCell>
											<TableCell>
												{t.scanned < t.total
													? `first ${t.scanned.toLocaleString()} of ${t.total.toLocaleString()}`
													: t.total.toLocaleString()}
											</TableCell>
											<TableCell>{t.affected.toLocaleString()}</TableCell>
											<TableCell
												className={
													t.would_fail ? "text-destructive" : undefined
												}
											>
												{t.would_fail.toLocaleString()}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</>
					) : null}
					<div className="flex flex-wrap gap-3 text-sm">
						{r.preview_run_id ? (
							<Link className="text-primary" to={runsPath(r.preview_run_id)}>
								Open the preview run
							</Link>
						) : null}
						{r.run_id ? (
							<Link className="text-primary" to={runsPath(r.run_id)}>
								Open the migration run
							</Link>
						) : null}
						{r.approval_id ? (
							<Link
								className="text-primary"
								to={approvalsPath({ username, graphSlug })}
							>
								Open Approvals
							</Link>
						) : null}
					</div>
				</>
			)}
			<DialogFooter>
				<Button variant="outline" onClick={onClose}>
					Close
				</Button>
			</DialogFooter>
		</>
	);
}

/** The stitches on a model and the datasets bound into it. */
function WhoReads({
	username,
	graphSlug,
	modelId,
	modelName,
	after,
}: {
	username: string;
	graphSlug: string;
	modelId: string;
	modelName: string;
	/** A line under the readers, when there are any. */
	after: string | null;
}) {
	const links = useModelLinksQuery(username, graphSlug);
	const bindings = useDatasetBindingsQuery(username, graphSlug);
	const stitches = (links.data ?? []).filter(
		(l) =>
			l.status === "active" &&
			(l.source_model === modelName || l.target_model === modelName),
	);
	const datasets = [
		...new Set(
			(bindings.data?.items ?? [])
				.filter((b) => b.model_id === modelId)
				.map((b) => b.address),
		),
	];
	const none = stitches.length === 0 && datasets.length === 0;
	return (
		<div className="space-y-1.5">
			<Eyebrow>Who reads {modelName}</Eyebrow>
			{links.isLoading || bindings.isLoading ? (
				<Spinner />
			) : none ? (
				<p className="text-sm text-muted-foreground">
					No stitch or bound dataset reads it yet.
				</p>
			) : (
				<>
					<div className="flex flex-wrap gap-1.5">
						{stitches.length ? (
							<Badge variant="outline">
								{stitches.length}{" "}
								{stitches.length === 1 ? "stitch" : "stitches"}
							</Badge>
						) : null}
						{datasets.map((d) => (
							<Badge key={d} variant="outline">
								{d}
							</Badge>
						))}
					</div>
					{after ? (
						<p className="text-sm text-muted-foreground">{after}</p>
					) : null}
				</>
			)}
		</div>
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
