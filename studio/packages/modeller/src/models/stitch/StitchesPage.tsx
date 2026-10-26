/**
 * The Stitches page — `stitches:<graph>` in `Workbook` (modeller.md › The
 * Stitches page).
 *
 * The Graph's stitches as rules, in two groups. **Active** holds every stitch
 * in the union and the staged ones, marked, with the staged set's *Commit* and
 * *Discard* above the list. **Removed** is read from the removal events — the
 * row itself is gone — and carries who removed it, when, and the edges
 * withdrawn. *Open* lands on the global model with that stitch inspected.
 */

import {
	Badge,
	Button,
	EmptyState,
	RecordHeader,
	SearchInput,
	SectionHeader,
	Spinner,
} from "@invana/ui";
import { formatRelativeTime } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { RecordRow } from "@invana-studio/ui";
import { Check, ChevronDown, ChevronRight, Link2, Plus } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	useCommitStitchesMutation,
	useDiscardStitchesMutation,
	useModelLinksQuery,
	useRemovedLinksQuery,
} from "../queries";
import type { ModelLink, RemovedStitch } from "../types";
import { stitchPair } from "./allModels";
import { DeclareStitchDialog } from "./components/DeclareStitchDialog";
import { holds, removedPair } from "./stitchText";
import { crossedLine, useStitchCrossings } from "./useStitchCrossings";

export interface StitchesPageProps {
	username: string;
	graphSlug: string;
}

/** The global model with one stitch inspected. */
const stitchPagePath = (username: string, graphSlug: string, linkId: string) =>
	`/u/${username}/${graphSlug}/modeller/global-model?stitch=${linkId}`;

const matches = (needle: string, ...haystack: (string | null)[]) =>
	haystack.some((h) => h?.toLowerCase().includes(needle));

function Group({
	title,
	count,
	children,
}: {
	title: string;
	count: number;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(true);
	return (
		<section className="flex flex-col">
			<SectionHeader
				bare
				title={
					<button
						type="button"
						aria-expanded={open}
						onClick={() => setOpen((o) => !o)}
						className="flex items-center gap-1.5"
					>
						{open ? (
							<ChevronDown className="size-3.5" />
						) : (
							<ChevronRight className="size-3.5" />
						)}
						{title}
					</button>
				}
				count={count}
			/>
			{open ? children : null}
		</section>
	);
}

export function StitchesPage({ username, graphSlug }: StitchesPageProps) {
	const navigate = useNavigate();
	const links = useModelLinksQuery(username, graphSlug);
	const removed = useRemovedLinksQuery(username, graphSlug);
	const crossings = useStitchCrossings(username, graphSlug);
	const commit = useCommitStitchesMutation(username, graphSlug);
	const discard = useDiscardStitchesMutation(username, graphSlug);
	const [declaring, setDeclaring] = useState(false);
	const [search, setSearch] = useState("");
	const needle = search.trim().toLowerCase();

	const all = links.data ?? [];
	const staged = all.filter((l) => l.status === "staged");
	const active = all.filter((l) => l.status === "active");
	// Staged first: what is about to land reads before what already has.
	const rows = useMemo(
		() =>
			[...staged, ...active].filter(
				(l) =>
					!needle ||
					matches(needle, stitchPair(l), l.kind, l.edge_type, l.status),
			),
		[staged, active, needle],
	);
	const gone = useMemo(
		() =>
			(removed.data ?? []).filter(
				(r) => !needle || matches(needle, removedPair(r), r.kind, r.removed_by),
			),
		[removed.data, needle],
	);

	const open = (id: string) =>
		navigate(stitchPagePath(username, graphSlug, id));

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				icon={<Link2 />}
				crumbs={["Stitches"]}
				chips={
					<Badge variant="outline" size="sm">
						{active.length} active
					</Badge>
				}
				actions={
					<ActButton area="model" size="sm" onClick={() => setDeclaring(true)}>
						<Plus />
						Declare a stitch
					</ActButton>
				}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-3">
					<SearchInput
						inputSize="sm"
						placeholder="Type to search stitches…"
						value={search}
						onChange={setSearch}
					/>

					{links.isLoading ? (
						<div className="flex justify-center p-6">
							<Spinner />
						</div>
					) : links.isError ? (
						<EmptyState
							title="The stitches could not be read"
							description={
								links.error instanceof Error
									? links.error.message
									: "The engine did not answer for this graph."
							}
						/>
					) : (
						<>
							{staged.length > 0 ? (
								<div className="flex items-center gap-2.5 rounded-control border bg-card py-1.5 pr-2 pl-3">
									<span className="size-1.5 rounded-full bg-warning" />
									<span>
										{staged.length} staged{" "}
										<span className="text-muted-foreground">
											· the union is unchanged until you commit
										</span>
									</span>
									<span className="flex-1" />
									<ActButton
										area="model"
										size="xs"
										disabled={commit.isPending}
										onClick={() => commit.mutate(undefined as never)}
									>
										<Check />
										Commit
									</ActButton>
									<ActButton
										area="model"
										size="xs"
										variant="ghost"
										disabled={discard.isPending}
										onClick={() => discard.mutate(undefined)}
									>
										Discard
									</ActButton>
								</div>
							) : null}

							<Group title="Active" count={rows.length}>
								{rows.length === 0 ? (
									<EmptyState
										title={needle ? "No stitch matches" : "No stitches yet"}
										description={
											needle
												? "Clear the search to see every stitch."
												: "Two models meet only where somebody says they meet. Declare a stitch, and the count of what resolves comes back before anything is written."
										}
									/>
								) : (
									<div className="flex flex-col divide-y rounded-control border bg-card">
										{rows.map((link) => (
											<ActiveRow
												key={link.id}
												link={link}
												crossed={crossedLine(crossings, link.id)}
												onOpen={() => open(link.id)}
											/>
										))}
									</div>
								)}
							</Group>

							<Group title="Removed" count={gone.length}>
								{gone.length === 0 ? (
									<p className="px-3 text-sm text-muted-foreground">
										{needle
											? "No removed stitch matches."
											: "No stitch has been removed."}
									</p>
								) : (
									<div className="flex flex-col divide-y rounded-control border bg-card">
										{gone.map((r) => (
											<RemovedRow key={`${r.id}:${r.removed_at}`} stitch={r} />
										))}
									</div>
								)}
							</Group>
						</>
					)}
				</div>
			</div>

			<DeclareStitchDialog
				kind={declaring ? "anchor" : null}
				username={username}
				graphSlug={graphSlug}
				onOpenStitch={(id) => {
					setDeclaring(false);
					open(id);
				}}
				onClose={() => setDeclaring(false)}
			/>
		</div>
	);
}

function ActiveRow({
	link,
	crossed,
	onOpen,
}: {
	link: ModelLink;
	crossed: string | null;
	onOpen: () => void;
}) {
	const line = [
		link.kind,
		link.status === "staged" ? "staged" : "active",
		holds(link),
		crossed,
	].filter(Boolean);
	return (
		<RecordRow
			tone={link.status === "staged" ? "warning" : "muted"}
			title={<span className="font-mono">{stitchPair(link)}</span>}
			subtitle={line.join(" · ")}
			actions={
				<Button variant="outline" size="sm" onClick={onOpen}>
					Open
				</Button>
			}
			pinActions
		/>
	);
}

function RemovedRow({ stitch }: { stitch: RemovedStitch }) {
	const withdrawn =
		stitch.edges_withdrawn === 0
			? "no edges withdrawn"
			: `${stitch.edges_withdrawn.toLocaleString()} ${stitch.edges_withdrawn === 1 ? "edge" : "edges"} withdrawn`;
	return (
		<RecordRow
			title={<span className="font-mono">{removedPair(stitch)}</span>}
			subtitle={[
				stitch.kind,
				`removed by ${stitch.removed_by ?? "—"}`,
				formatRelativeTime(new Date(stitch.removed_at)),
				withdrawn,
			].join(" · ")}
		/>
	);
}
