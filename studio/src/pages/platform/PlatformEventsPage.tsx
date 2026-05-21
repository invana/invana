import { Button, Skeleton } from "@invana/ui";
import { Activity, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
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
	const [actionPrefix, setActionPrefix] = useState<string | undefined>();

	const query = useGlobalEventsQuery({
		graph_id: graphIdFilter,
		action_prefix: actionPrefix,
	});

	useEventStream({ scope: "global" });

	// Gate the page at render time — RoleGate-superuser. Non-superusers get
	// bounced back to /graphs rather than 403'd.
	if (!user?.is_superuser) {
		return <Navigate to="/graphs" replace />;
	}

	const all = query.data?.pages.flatMap((p) => p.items) ?? [];

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
					actionPrefix={actionPrefix}
					onActionPrefixChange={setActionPrefix}
					graphIdFilter={graphIdFilter}
					onGraphIdFilterChange={setGraphIdFilter}
				/>

				<div className="mt-4">
					{query.isLoading ? (
						<EventsSkeleton />
					) : all.length === 0 ? (
						<EmptyState />
					) : (
						<ul className="space-y-1.5">
							{all.map((e) => (
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

const PREFIX_OPTIONS: { label: string; value: string | undefined }[] = [
	{ label: "All", value: undefined },
	{ label: "Graph", value: "graph." },
	{ label: "Connection", value: "connection." },
	{ label: "LLMs", value: "llm." },
	{ label: "Skills", value: "skill." },
	{ label: "Instructions", value: "instruction." },
	{ label: "Members", value: "member." },
	{ label: "Setup", value: "setup." },
	{ label: "Auth", value: "auth." },
	{ label: "Query", value: "query." },
	{ label: "System", value: "system." },
];

function FilterBar({
	actionPrefix,
	onActionPrefixChange,
	graphIdFilter,
	onGraphIdFilterChange,
}: {
	actionPrefix: string | undefined;
	onActionPrefixChange: (v: string | undefined) => void;
	graphIdFilter: string | undefined;
	onGraphIdFilterChange: (v: string | undefined) => void;
}) {
	return (
		<div className="space-y-2">
			<div className="flex flex-wrap gap-1">
				{PREFIX_OPTIONS.map((opt) => {
					const isActive = opt.value === actionPrefix;
					return (
						<button
							type="button"
							key={opt.label}
							onClick={() => onActionPrefixChange(opt.value)}
							className={`px-2 py-1 rounded border ${
								isActive
									? "bg-primary text-primary-foreground border-primary"
									: "bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
							}`}
						>
							{opt.label}
						</button>
					);
				})}
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
