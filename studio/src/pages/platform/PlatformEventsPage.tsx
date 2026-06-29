import { Button, SearchInput, Skeleton } from "@invana/ui";
import { Activity, ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { EventTypeFilter } from "../../components/settings/sections/EventTypeFilter";
import { matchesEventSearch } from "../../components/settings/sections/eventSearch";
import {
	StatusFilter,
	matchesStatusFilter,
} from "../../components/settings/sections/eventStatus";
import { useGlobalEventsQuery } from "../../hooks/queries/useEvents";
import { useAuth } from "../../hooks/useAuth";
import { useEventStream } from "../../hooks/useEventStream";
import type { AuditEvent } from "../../types/events";

/**
 * Platform-wide events view (RFC-018) — superuser-only. Mirrors the per-graph
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
					actions={actions}
					onActionsChange={setActions}
					statuses={statuses}
					onStatusesChange={setStatuses}
					graphIdFilter={graphIdFilter}
					onGraphIdFilterChange={setGraphIdFilter}
				/>

				<div className="mt-3">
					<SearchInput value={search} onChange={setSearch} className="w-full" />
				</div>

				<div className="mt-4">
					{query.isLoading ? (
						<EventsSkeleton />
					) : all.length === 0 ? (
						<EmptyState />
					) : visible.length === 0 ? (
						<NoMatches />
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

function FilterBar({
	actions,
	onActionsChange,
	statuses,
	onStatusesChange,
	graphIdFilter,
	onGraphIdFilterChange,
}: {
	actions: string[];
	onActionsChange: (v: string[]) => void;
	statuses: string[];
	onStatusesChange: (v: string[]) => void;
	graphIdFilter: string | undefined;
	onGraphIdFilterChange: (v: string | undefined) => void;
}) {
	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-2">
				<EventTypeFilter value={actions} onChange={onActionsChange} />
				<StatusFilter value={statuses} onChange={onStatusesChange} />
			</div>
			<div className="flex items-center gap-2">
				<label htmlFor="graph-filter" className="text-muted-foreground">
					Filter by graph id:
				</label>
				<input
					id="graph-filter"
					type="text"
					placeholder="(any)"
					value={graphIdFilter ?? ""}
					onChange={(e) => onGraphIdFilterChange(e.target.value || undefined)}
					className="flex-1 max-w-md px-2 py-1 rounded border border-border bg-background font-mono"
				/>
			</div>
		</div>
	);
}

function EventRow({ event }: { event: AuditEvent }) {
	const actor =
		event.actor_type === "system"
			? "system"
			: event.actor_type === "anonymous"
				? "anonymous"
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

function EmptyState() {
	return (
		<p className="text-muted-foreground py-8 text-center">
			No events match the current filters.
		</p>
	);
}

function NoMatches() {
	return (
		<div className="text-muted-foreground py-8 text-center">
			<p>No loaded events match the current filters.</p>
			<p className="text-xs mt-1 opacity-70">
				Status and search scan loaded events — use "Load older" to widen the
				range.
			</p>
		</div>
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
