import { useGraphEventsQuery } from "@/hooks/queries/useEvents";
import { useEventStream } from "@/hooks/useEventStream";
import { EventTypeFilter } from "@/pages/graphs-detail/features/operate/EventTypeFilter";
import { matchesEventSearch } from "@/pages/graphs-detail/features/operate/eventSearch";
import {
	type EventStatus,
	StatusFilter,
	eventStatus,
	matchesStatusFilter,
} from "@/pages/graphs-detail/features/operate/eventStatus";
import type { AuditEvent } from "@/types/events";
import {
	Badge,
	Button,
	SearchInput,
	Skeleton,
	StatusDot,
	type StatusDotProps,
	TimelineEntry,
	TimelineFooter,
	TimelineList,
} from "@invana/ui";
import {
	Activity,
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Clock,
	Database,
	Layers,
	Lightbulb,
	ScrollText,
	Sparkles,
	UserCircle,
	Users,
	Wand2,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

interface Props {
	username: string;
	graphSlug: string;
}

/**
 * Per-graph events view. Renders the SSE-driven live tail of audit events
 * for the active graph. Rendered inside the docked SettingsPanel; the
 * panel's expand toggle takes the section to full width in place.
 *
 * An event-type filter (server-side) sits above the list, with a derived
 * status filter and a free-text search bar (both client-side over the loaded
 * buffer). Pagination is append-as-you-scroll via
 * `useGraphEventsQuery.fetchNextPage`.
 *
 * The tail reads as a timeline (audit-and-activity.md AA6): `TimelineList` in
 * its `rail` variant, because the panel is docked and narrow — a fixed `when`
 * column would eat a third of the width. `Load older` sits in the
 * `TimelineFooter` so the rail runs into it, which is what says the history
 * continues past what is loaded.
 */
export function EventsSection({ username, graphSlug }: Props) {
	const [actions, setActions] = useState<string[]>([]);
	const [statuses, setStatuses] = useState<string[]>([]);
	const [search, setSearch] = useState("");

	const query = useGraphEventsQuery(username, graphSlug, {
		actions: actions.length > 0 ? actions : undefined,
	});

	// SSE live tail — invalidates the queryKey on each incoming row so the
	// list head refreshes without polling.
	useEventStream({ scope: "graph", username, graphSlug });

	const all = useMemo(
		() => query.data?.pages.flatMap((p) => p.items) ?? [],
		[query.data],
	);

	// Search + status filter the loaded buffer client-side (the read API has no
	// full-text or status filter); the type filter above narrows server-side.
	const visible = useMemo(
		() =>
			all.filter(
				(e) =>
					matchesStatusFilter(e, statuses) && matchesEventSearch(e, search),
			),
		[all, statuses, search],
	);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<EventTypeFilter value={actions} onChange={setActions} />
				<StatusFilter value={statuses} onChange={setStatuses} />
			</div>
			<SearchInput value={search} onChange={setSearch} className="w-full" />

			{query.isLoading ? (
				<EventsSkeleton />
			) : all.length === 0 ? (
				<EmptyState />
			) : visible.length === 0 ? (
				<NoMatches />
			) : (
				<TimelineList variant="rail">
					{visible.map((e) => (
						<EventEntry key={e.id} event={e} />
					))}
					{query.hasNextPage && (
						<TimelineFooter>
							<Button
								variant="ghost"
								size="sm"
								className="w-full"
								onClick={() => query.fetchNextPage()}
								disabled={query.isFetchingNextPage}
							>
								{query.isFetchingNextPage ? "Loading…" : "Load older"}
							</Button>
						</TimelineFooter>
					)}
				</TimelineList>
			)}
		</div>
	);
}

// ── Event entry ───────────────────────────────────────────────────────────────

/** The derived outcome, as a marker tone. Most events record no outcome. */
const STATUS_TONE: Record<EventStatus, NonNullable<StatusDotProps["tone"]>> = {
	success: "success",
	failed: "error",
	none: "muted",
};

const STATUS_LABEL: Record<EventStatus, string> = {
	success: "succeeded",
	failed: "failed",
	none: "no recorded outcome",
};

function EventEntry({ event }: { event: AuditEvent }) {
	const [expanded, setExpanded] = useState(false);
	const Icon = iconForAction(event.action);
	const status = eventStatus(event);
	const summary = summarizeDetails(event);

	return (
		<TimelineEntry
			marker={
				<StatusDot
					tone={STATUS_TONE[status]}
					size="sm"
					label={STATUS_LABEL[status]}
				/>
			}
			when={
				<span className="flex items-center gap-1.5">
					<RelTime iso={event.created_at} />
					<span>·</span>
					<span className="truncate">{actorDisplay(event)}</span>
				</span>
			}
			title={
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					aria-expanded={expanded}
					className="flex w-full items-start gap-1.5 text-left hover:text-primary transition-colors"
				>
					{expanded ? (
						<ChevronDown className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
					) : (
						<ChevronRight className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
					)}
					<Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
					<span className="min-w-0 flex-1">
						<span className="font-mono">{event.action}</span>
						{summary && (
							<span className="ml-1.5 font-normal text-muted-foreground">
								{summary}
							</span>
						)}
					</span>
				</button>
			}
		>
			{expanded && (
				<div className="mt-1 rounded-md border border-border bg-muted/20 px-2.5 py-2">
					<DetailsView event={event} />
				</div>
			)}
		</TimelineEntry>
	);
}

function DetailsView({ event }: { event: AuditEvent }) {
	const rows: { label: string; value: ReactNode }[] = [
		{ label: "event id", value: <code className="font-mono">{event.id}</code> },
		{
			label: "action",
			value: <code className="font-mono">{event.action}</code>,
		},
		{
			label: "actor",
			value: (
				<>
					<Badge variant="outline">{event.actor_kind}</Badge>{" "}
					{event.actor ? (
						<code className="font-mono">@{event.actor.username}</code>
					) : (
						<span className="text-muted-foreground">—</span>
					)}
				</>
			),
		},
		event.target_kind
			? {
					label: "target",
					value: (
						<code className="font-mono">
							{event.target_kind}
							{event.target_id ? `:${event.target_id}` : ""}
						</code>
					),
				}
			: {
					label: "target",
					value: <span className="text-muted-foreground">—</span>,
				},
		event.trace_id
			? {
					label: "trace",
					value: (
						<code className="font-mono">{event.trace_id.slice(0, 16)}…</code>
					),
				}
			: {
					label: "trace",
					value: <span className="text-muted-foreground">—</span>,
				},
	];

	return (
		<div className="space-y-2">
			<dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5">
				{rows.map((r) => (
					<DetailRow key={r.label} label={r.label} value={r.value} />
				))}
			</dl>
			{Object.keys(event.details).length > 0 && (
				<details>
					<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
						payload
					</summary>
					<pre className="mt-1 p-2 bg-background border border-border rounded font-mono overflow-x-auto whitespace-pre-wrap">
						{JSON.stringify(event.details, null, 2)}
					</pre>
				</details>
			)}
		</div>
	);
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd>{value}</dd>
		</>
	);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Who did it, in the words that kind of principal is named by.
 *
 * An **agent** row carries a null `actor` — the actor is not a user — and its
 * name arrives as `actor_name`, from the agents table or from the event's own
 * snapshot when the agent is gone. Without that branch every agent's event
 * read as `(deleted user)`, which is the one reading it is not.
 */
function actorDisplay(event: AuditEvent): string {
	if (event.actor_kind === "system") return "system";
	if (event.actor_kind === "anonymous") return "anonymous";
	if (event.actor_kind === "agent" || event.actor_kind === "external") {
		return event.actor_name ?? event.actor_kind;
	}
	return event.actor ? `@${event.actor.username}` : "(deleted user)";
}

function summarizeDetails(event: AuditEvent): string | null {
	const d = event.details;
	if (!d) return null;
	const name = typeof d.name === "string" ? d.name : null;
	const changedKeys =
		d.changed && typeof d.changed === "object"
			? Object.keys(d.changed as Record<string, unknown>)
			: null;
	if (name && changedKeys && changedKeys.length > 0) {
		return `'${name}' (${changedKeys.join(", ")})`;
	}
	if (name) return `'${name}'`;
	if (typeof d.section === "string") return `section: ${d.section}`;
	if (typeof d.model_id === "string") return d.model_id;
	if (typeof d.uri === "string") return d.uri;
	return null;
}

function iconForAction(action: string) {
	const prefix = action.split(".")[0];
	switch (prefix) {
		case "graph":
			return Database;
		case "connection":
			return Database;
		case "llm":
			return Sparkles;
		case "skill":
			return Wand2;
		case "instruction":
			return ScrollText;
		case "member":
			return Users;
		case "auth":
			return UserCircle;
		case "setup":
			return Lightbulb;
		case "query":
			return Layers;
		case "system":
			return AlertCircle;
		default:
			return Activity;
	}
}

function RelTime({ iso }: { iso: string }) {
	const ms = Date.now() - new Date(iso).getTime();
	const s = Math.floor(ms / 1000);
	const label =
		s < 60
			? `${s}s ago`
			: s < 3600
				? `${Math.floor(s / 60)}m ago`
				: s < 86400
					? `${Math.floor(s / 3600)}h ago`
					: `${Math.floor(s / 86400)}d ago`;
	return (
		<span className="flex items-center gap-1" title={iso}>
			<Clock className="w-3 h-3" />
			{label}
		</span>
	);
}

// ── States ────────────────────────────────────────────────────────────────────

function EmptyState() {
	return (
		<div className="text-center text-muted-foreground py-8">
			<CheckCircle2 className="w-6 h-6 mx-auto mb-2 opacity-50" />
			<p>
				No events yet — the audit trail starts as soon as someone changes
				something.
			</p>
		</div>
	);
}

function NoMatches() {
	return (
		<div className="text-center text-muted-foreground py-8">
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
				<Skeleton key={i} className="h-12 w-full" />
			))}
		</div>
	);
}
