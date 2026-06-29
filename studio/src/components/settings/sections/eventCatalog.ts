/**
 * Catalog of audit event types, grouped by feature area, for the events
 * filter UI. Mirrors the engine's action vocabulary in
 * `engine/src/invana/events/actions.py` — keep the two in sync when new
 * actions land. Used by `EventTypeFilter` to drive the searchable
 * multi-select; the selected `action` strings are sent verbatim to the read
 * API's repeatable `action` query param.
 */

export interface EventType {
	/** Exact `action` string as stored on the event row. */
	action: string;
	/** Short human label shown in the picker. */
	label: string;
}

export interface EventCategory {
	/** Stable key (the dotted prefix, sans trailing dot). */
	key: string;
	label: string;
	types: EventType[];
}

export const EVENT_CATEGORIES: EventCategory[] = [
	{
		key: "graph",
		label: "Graph",
		types: [
			{ action: "graph.create", label: "Created" },
			{ action: "graph.update", label: "Updated" },
			{ action: "graph.delete", label: "Deleted" },
			{ action: "graph.archive", label: "Archived" },
			{ action: "graph.unarchive", label: "Unarchived" },
			{ action: "graph.expand", label: "Node expanded" },
		],
	},
	{
		key: "connection",
		label: "Connection",
		types: [
			{ action: "connection.attach", label: "Attached" },
			{ action: "connection.update", label: "Updated" },
			{ action: "connection.delete", label: "Deleted" },
			{ action: "connection.test", label: "Tested" },
			{ action: "connection.ping", label: "Pinged" },
			{ action: "connection.introspect", label: "Introspected" },
			{ action: "connection.version_detected", label: "Version detected" },
			{
				action: "connection.compatibility_downgrade",
				label: "Compatibility downgrade",
			},
			{
				action: "connection.version_acknowledge",
				label: "Version acknowledged",
			},
			{ action: "connection.version_declare", label: "Version declared" },
		],
	},
	{
		key: "llm",
		label: "LLMs",
		types: [
			{ action: "llm.create", label: "Created" },
			{ action: "llm.update", label: "Updated" },
			{ action: "llm.delete", label: "Deleted" },
			{ action: "llm.ping", label: "Pinged" },
			{ action: "llm.set_default", label: "Set default" },
			{ action: "llm.translate", label: "NL → query" },
			{ action: "llm.generate", label: "Generate" },
		],
	},
	{
		key: "skill",
		label: "Skills",
		types: [
			{ action: "skill.create", label: "Created" },
			{ action: "skill.update", label: "Updated" },
			{ action: "skill.delete", label: "Deleted" },
		],
	},
	{
		key: "model",
		label: "Models",
		types: [
			{ action: "model.create", label: "Created" },
			{ action: "model.update", label: "Updated" },
			{ action: "model.delete", label: "Deleted" },
			{ action: "model.activate", label: "Activated" },
			{ action: "model.generate", label: "Generated" },
		],
	},
	{
		key: "dataset",
		label: "Datasets",
		types: [{ action: "dataset.import", label: "Imported" }],
	},
	{
		key: "member",
		label: "Members",
		types: [{ action: "member.add", label: "Added" }],
	},
	{
		key: "setup",
		label: "Setup",
		types: [
			{ action: "setup.complete", label: "Completed" },
			{ action: "setup.skip", label: "Skipped" },
			{ action: "setup.reset", label: "Reset" },
		],
	},
	{
		key: "query",
		label: "Query",
		types: [{ action: "query.execute", label: "Executed" }],
	},
	{
		key: "session",
		label: "Sessions",
		types: [
			{ action: "session.create", label: "Created" },
			{ action: "session.delete", label: "Deleted" },
		],
	},
	{
		key: "auth",
		label: "Auth",
		types: [
			{ action: "auth.register", label: "Registered" },
			{ action: "auth.login", label: "Logged in" },
			{ action: "auth.login_failed", label: "Login failed" },
			{ action: "auth.logout", label: "Logged out" },
			{ action: "auth.refresh", label: "Token refreshed" },
			{ action: "auth.password_change", label: "Password changed" },
			{ action: "auth.username_change", label: "Username changed" },
		],
	},
	{
		key: "system",
		label: "System",
		types: [
			{
				action: "system.connection_health_check",
				label: "Connection health check",
			},
			{ action: "system.connection_reconnect", label: "Connection reconnect" },
			{ action: "system.introspect_complete", label: "Introspect complete" },
			{ action: "superuser.provision", label: "Superuser provisioned" },
		],
	},
];

/** All known event-type action strings, flattened. */
export const ALL_EVENT_TYPES: string[] = EVENT_CATEGORIES.flatMap((c) =>
	c.types.map((t) => t.action),
);

/** Friendly label for a category key (falls back to the key itself). */
export function categoryLabel(key: string): string {
	return EVENT_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
