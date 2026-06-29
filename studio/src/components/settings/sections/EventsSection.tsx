import { Badge, Button, SearchInput, Skeleton } from "@invana/ui";
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
import { useGraphEventsQuery } from "../../../hooks/queries/useEvents";
import { useEventStream } from "../../../hooks/useEventStream";
import type { AuditEvent } from "../../../types/events";
import { EventTypeFilter } from "./EventTypeFilter";
import { matchesEventSearch } from "./eventSearch";
import { StatusFilter, matchesStatusFilter } from "./eventStatus";

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
				<ul className="space-y-1.5">
					{visible.map((e) => (
						<EventRow key={e.id} event={e} />
					))}
				</ul>
			)}

			{query.hasNextPage && (
				<div className="pt-2">
					<Button
						variant="ghost"
						size="sm"
						className="w-full"
						onClick={() => query.fetchNextPage()}
						disabled={query.isFetchingNextPage}
					>
						{query.isFetchingNextPage ? "Loading…" : "Load older"}
					</Button>
				</div>
			)}
		</div>
	);
}

// ── Event row ─────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: AuditEvent }) {
	const [expanded, setExpanded] = useState(false);
	const Icon = iconForAction(event.action);
	const actorLabel = actorDisplay(event);

	return (
		<li className="border border-border rounded-md">
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="w-full flex items-start gap-2 p-2.5 text-left hover:bg-muted/40 transition-colors"
			>
				{expanded ? (
					<ChevronDown className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
				) : (
					<ChevronRight className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
				)}
				<Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1.5 flex-wrap">
						<span className="font-mono">{event.action}</span>
						{summarizeDetails(event) && (
							<span className="text-muted-foreground truncate">
								{summarizeDetails(event)}
							</span>
						)}
					</div>
					<div className="flex items-center gap-2 text-muted-foreground mt-0.5">
						<span>{actorLabel}</span>
						<span>·</span>
						<RelTime iso={event.created_at} />
					</div>
				</div>
			</button>
			{expanded && (
				<div className="border-t border-border px-2.5 py-2 bg-muted/20">
					<DetailsView event={event} />
				</div>
			)}
		</li>
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
					<Badge variant="outline">{event.actor_type}</Badge>{" "}
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

function actorDisplay(event: AuditEvent): string {
	if (event.actor_type === "system") return "system";
	if (event.actor_type === "anonymous") return "anonymous";
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
