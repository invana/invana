/**
 * The change log — Activity › Events with its Changes filter on (board
 * `shell.events.changes`).
 *
 * The rows are the Graph's version-minting events (`events?changes=true`).
 * Each names its record from that record's history, which also carries the
 * version before it, a one-line summary and the effect after: when · who ·
 * product · `name vA → vB · summary` · effect · *Compare*. A deleted record's
 * history answers 404: its row takes the event's own name snapshot, says what
 * the event did in words, and is marked *deleted*. Every record on the
 * loaded pages is read once, so a page of changes is one events read plus one
 * history read per record it touches.
 *
 * Product and Who narrow the loaded rows; search reads name, summary, why
 * and who. `Load older` pages back like the Events tab does.
 */

import {
	Badge,
	Button,
	EmptyState,
	FilterBar,
	MultiFilterChip,
	SearchInput,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableRow,
} from "@invana/ui";
import { ApiError } from "@invana-studio/core";
import { PanelSection } from "@invana-studio/ui";
import { History } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "../../products";
import { comparePath } from "../activityPath";
import { useGraphEventsQuery } from "../events/queries";
import type { AuditEvent } from "../events/types";
import {
	type ChangeEntry,
	type ChangeRef,
	changeOf,
	changeVerb,
	effectLine,
	PRODUCT_OF,
	type RecordHistory,
	snapshotName,
	useRecordHistories,
} from "./history";

interface Row {
	event: AuditEvent;
	ref: ChangeRef;
	name: string;
	entry: ChangeEntry | null;
	/** The version before it — null for a first version. */
	before: string | null;
	who: string;
	/** The record is gone; its name is the event's snapshot. */
	deleted: boolean;
}

const day = (iso: string) =>
	new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});

const recordKey = (r: { kind: string; id: string }) => `${r.kind}:${r.id}`;

/** A user is named by their username; anyone else by their kind. */
function who(event: AuditEvent, entry: ChangeEntry | null): string {
	if (entry?.actor_name) return entry.actor_name;
	if (event.actor) return event.actor.username;
	return event.actor_name ?? event.actor_kind;
}

export function ChangesList({
	username,
	graphSlug,
	toggle,
}: {
	username: string;
	graphSlug: string;
	/** The Changes chip, so turning the filter off sits where it was turned on. */
	toggle: ReactNode;
}) {
	const graph = { username, graphSlug };
	const navigate = useNavigate();
	const products = useProducts();
	const [productFilter, setProductFilter] = useState<string[]>([]);
	const [whoFilter, setWhoFilter] = useState<string[]>([]);
	const [search, setSearch] = useState("");

	const query = useGraphEventsQuery(username, graphSlug, { changes: true });
	const events = useMemo(
		() => query.data?.pages.flatMap((p) => p.items) ?? [],
		[query.data],
	);
	const changes = useMemo(
		() =>
			events.flatMap((event) => {
				const ref = changeOf(event);
				return ref ? [{ event, ref }] : [];
			}),
		[events],
	);
	const records = useMemo(() => {
		const seen = new Map<string, { kind: ChangeRef["kind"]; id: string }>();
		for (const { ref } of changes) seen.set(recordKey(ref), ref);
		return [...seen.values()];
	}, [changes]);
	const histories = useRecordHistories(graph, records);
	const byRecord = new Map<string, RecordHistory>();
	const gone = new Set<string>();
	histories.forEach((h, i) => {
		const r = records[i];
		if (!r) return;
		if (h.data) byRecord.set(recordKey(r), h.data);
		else if (h.error instanceof ApiError && h.error.status === 404)
			gone.add(recordKey(r));
	});

	const rows: Row[] = changes.map(({ event, ref }) => {
		const history = byRecord.get(recordKey(ref));
		const items = history?.items ?? [];
		const at = items.findIndex((v) => v.version === ref.version);
		const entry = at >= 0 ? (items[at] ?? null) : null;
		return {
			event,
			ref,
			name: history?.name ?? snapshotName(event, ref.kind),
			entry,
			before: at >= 0 ? (items[at + 1]?.version ?? null) : null,
			who: who(event, entry),
			deleted: gone.has(recordKey(ref)),
		};
	});

	const productName = (id: string) =>
		products.find((p) => p.id === id)?.name ?? id;
	const people = [...new Set(rows.map((r) => r.who))].sort();
	const needle = search.trim().toLowerCase();
	const visible = rows.filter(
		(r) =>
			(!productFilter.length ||
				productFilter.includes(PRODUCT_OF[r.ref.kind])) &&
			(!whoFilter.length || whoFilter.includes(r.who)) &&
			(!needle ||
				[r.name, r.entry?.summary, r.entry?.why, r.who].some((s) =>
					s?.toLowerCase().includes(needle),
				)),
	);
	const oldest = rows.at(-1)?.event.created_at;
	const span = oldest
		? Math.max(
				1,
				Math.ceil((Date.now() - new Date(oldest).getTime()) / 86_400_000),
			)
		: 0;

	return (
		<div className="space-y-4">
			<FilterBar className="rounded-sm border">
				{toggle}
				<MultiFilterChip
					label="Product"
					multiple={false}
					options={[...new Set(Object.values(PRODUCT_OF))].map((id) => ({
						value: id,
						label: productName(id),
					}))}
					value={productFilter}
					onChange={setProductFilter}
				/>
				<MultiFilterChip
					label="Who"
					options={people}
					value={whoFilter}
					onChange={setWhoFilter}
				/>
			</FilterBar>
			<SearchInput
				inputSize="sm"
				value={search}
				onChange={setSearch}
				placeholder="Search changes…"
				className="w-full"
			/>
			{query.isLoading ? (
				<div className="space-y-1.5">
					{[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-10 w-full" />
					))}
				</div>
			) : rows.length === 0 ? (
				<EmptyState
					icon={<History className="size-6" />}
					title="No changes yet"
					description="A change is a new version of a skill, a rule, a plan, an agent or a model. Each one lands here with who made it, why, and what ran on it after."
				/>
			) : (
				<PanelSection
					card
					title="Changes"
					action={
						<span className="text-sm text-muted-foreground">
							{visible.length} in {span} day{span === 1 ? "" : "s"} · a change
							is one more event
						</span>
					}
				>
					{visible.length === 0 ? (
						<p className="text-muted-foreground">
							No loaded change matches — clear a filter, or load older ones.
						</p>
					) : (
						<Table bordered={false} density="compact">
							<TableBody>
								{visible.map((r) => (
									<TableRow key={r.event.id}>
										<TableCell className="whitespace-nowrap">
											{day(r.event.created_at)}
										</TableCell>
										<TableCell className="whitespace-nowrap">{r.who}</TableCell>
										<TableCell>
											<Badge variant="outline" size="xs">
												{productName(PRODUCT_OF[r.ref.kind])}
											</Badge>
										</TableCell>
										<TableCell className="w-full">
											<span className="font-semibold">
												{r.name}
												{r.ref.version
													? r.before
														? ` v${r.before} → v${r.ref.version}`
														: ` v${r.ref.version}`
													: ""}
											</span>
											<span className="text-muted-foreground">
												{" · "}
												{r.entry?.summary ?? changeVerb(r.event.action)}
											</span>
											{r.deleted ? (
												<Badge variant="outline" size="xs" className="ml-2">
													deleted
												</Badge>
											) : null}
										</TableCell>
										<TableCell className="whitespace-nowrap text-muted-foreground">
											{r.entry ? effectLine(r.entry.effect) : "—"}
										</TableCell>
										<TableCell>
											{r.entry && r.before ? (
												<Button
													variant="outline"
													size="sm"
													onClick={() =>
														navigate(
															comparePath(graph, r.ref.kind, r.ref.id, {
																a: r.before,
																b: r.ref.version,
															}),
														)
													}
												>
													Compare
												</Button>
											) : null}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
					{query.hasNextPage ? (
						<Button
							variant="ghost"
							size="sm"
							className="w-full"
							onClick={() => query.fetchNextPage()}
							disabled={query.isFetchingNextPage}
						>
							{query.isFetchingNextPage ? "Loading…" : "Load older"}
						</Button>
					) : null}
				</PanelSection>
			)}
		</div>
	);
}
