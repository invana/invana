import { useGlobalEventsQuery } from "@/hooks/queries/useEvents";
import { useAuth } from "@/hooks/useAuth";
import { useEventStream } from "@/hooks/useEventStream";
import { EventTypeFilter } from "@/pages/graphs-detail/features/operate/EventTypeFilter";
import { matchesEventSearch } from "@/pages/graphs-detail/features/operate/eventSearch";
import {
	StatusFilter,
	matchesStatusFilter,
} from "@/pages/graphs-detail/features/operate/eventStatus";
import type { AuditEvent } from "@/types/events";
import { Input } from "@invana/forms";
import {
	Button,
	EmptyState,
	FilterBar,
	SearchInput,
	Skeleton,
} from "@invana/ui";
import { Activity, ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

/**
 * Platform-wide events view (docs/for-developers/modules/operate/features/audit-and-activity.md) — superuser-only. Mirrors the per-graph
 * EventsSection layout but operates over the global `/api/v1/events`
 * endpoint and adds a graph filter dropdown.
 */
export function PlatformEventsPage() {
	const { user } = useAuth();
	const [graphIdFilter, setGraphIdFilter] = useState<string | undefined>();
	const [actions, setActions] = useState<string[]>([]);
	const [statuses, setStatuses] = useState<string[]>([]);
	const [search, setSearch] = useState("");

	const query = useGlobalEventsQuery({
		graph_id: graphIdFilter,
		actions: actions.length > 0 ? actions : undefined,
	});

	useEventStream({ scope: "global" });

	const all = useMemo(
		() => query.data?.pages.flatMap((p) => p.items) ?? [],
		[query.data],
	);
	const visible = useMemo(
		() =>
			all.filter(
				(e) =>
					matchesStatusFilter(e, statuses) && matchesEventSearch(e, search),
			),
		[all, statuses, search],
	);

	// Gate the page at render time — superuser only. Non-superusers get
	// bounced back to /graphs rather than 403'd.
	if (!user?.is_superuser) {
		return <Navigate to="/graphs" replace />;
	}

	return (
		<div className="h-full overflow-auto">
			<div className="max-w-5xl mx-auto px-10 py-12">
				<Link
					to="/graphs"
					className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-8 w-fit"
				>
					<ArrowLeft className="w-4 h-4" />
					<span>Back</span>
				</Link>

				<div className="mb-8">
					<p className="text-muted-foreground font-mono">/platform/events</p>
					<h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
						<Activity className="w-6 h-6" />
						Platform events
					</h1>
					<p className="text-muted-foreground mt-1">
						Append-only audit log across every graph + every user on this
						engine. Visible to superusers only.
					</p>
				</div>

				<FilterBar
					className="mt-3 rounded-sm border"
					summary={`${visible.length.toLocaleString()} shown`}
				>
					<EventTypeFilter value={actions} onChange={setActions} />
					<StatusFilter value={statuses} onChange={setStatuses} />
					<Input
						aria-label="Filter by graph id"
						placeholder="graph id"
						value={graphIdFilter ?? ""}
						onChange={(e) => setGraphIdFilter(e.target.value || undefined)}
						className="h-[22px] w-48 font-mono"
					/>
				</FilterBar>

				<div className="mt-3">
					<SearchInput value={search} onChange={setSearch} className="w-full" />
				</div>

				<div className="mt-4">
					{query.isLoading ? (
						<EventsSkeleton />
					) : all.length === 0 ? (
						<EmptyState
							title="No events yet"
							description="The audit log starts as soon as someone changes something on this engine."
						/>
					) : visible.length === 0 ? (
						<EmptyState
							title="No loaded events match the current filters"
							description={
								'Status and search scan loaded events — use "Load older" to widen the range.'
							}
						/>
					) : (
						<ul className="space-y-1.5">
							{visible.map((e) => (
								<EventRow key={e.id} event={e} />
							))}
						</ul>
					)}

					{query.hasNextPage && (
						<div className="pt-3">
							<Button
								variant="ghost"
								className="w-full"
								onClick={() => query.fetchNextPage()}
								disabled={query.isFetchingNextPage}
							>
								{query.isFetchingNextPage ? "Loading…" : "Load older"}
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function EventRow({ event }: { event: AuditEvent }) {
	// An agent row carries a null `actor` and its name in `actor_name`, so it
	// needs its own branch — without it every agent read as `(deleted)`.
	const actor =
		event.actor_kind === "system"
			? "system"
			: event.actor_kind === "anonymous"
				? "anonymous"
				: event.actor_kind === "agent" || event.actor_kind === "external"
					? (event.actor_name ?? event.actor_kind)
					: event.actor
						? `@${event.actor.username}`
						: "(deleted)";
	const time = new Date(event.created_at).toLocaleString();
	return (
		<li className="border border-border rounded-md p-2.5 hover:bg-muted/30 transition-colors">
			<div className="flex items-center gap-2 flex-wrap">
				<code className="font-mono">{event.action}</code>
				{event.target_id && (
					<span className="text-muted-foreground font-mono">
						{event.target_kind}:{event.target_id.slice(0, 8)}
					</span>
				)}
			</div>
			<div className="flex items-center gap-2 text-muted-foreground mt-0.5">
				<span>{actor}</span>
				<span>·</span>
				{event.graph_id && (
					<>
						<span className="font-mono">
							graph:{event.graph_id.slice(0, 8)}
						</span>
						<span>·</span>
					</>
				)}
				<span>{time}</span>
			</div>
			{Object.keys(event.details).length > 0 && (
				<details className="mt-1.5">
					<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
						payload
					</summary>
					<pre className="mt-1 p-2 bg-muted border border-border rounded font-mono overflow-x-auto whitespace-pre-wrap">
						{JSON.stringify(event.details, null, 2)}
					</pre>
				</details>
			)}
		</li>
	);
}

function EventsSkeleton() {
	return (
		<div className="space-y-1.5">
			{Array.from({ length: 6 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
				<Skeleton key={i} className="h-14 w-full" />
			))}
		</div>
	);
}
