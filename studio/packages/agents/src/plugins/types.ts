/**
 * The plugin registry as the engine returns it — `GET /api/v1/plugins`,
 * `GET /api/v1/plugins/{name}`, `GET /api/v1/task-types/{ref}`. Install-level,
 * not Graph-scoped: the registry is the process's, the same for every Graph.
 */

/** `core` · `simulator` · `tool` · `mcp`. */
type PluginKind = "core" | "simulator" | "tool" | "mcp";

interface PluginBase {
	name: string;
	kind: PluginKind;
	version: string;
	title: string;
	/** The pip extra that installs it; empty for a core plugin. */
	extra: string;
	installed: boolean;
	enabled: boolean;
	/** Whether an install Admin may enable or disable it. */
	switchable: boolean;
	/** Stored at a revision this process has not loaded — restart to load it. */
	restart_required: boolean;
}

export interface PluginSummary extends PluginBase {
	task_types: number;
	skills: number;
	flows: number;
}

export interface PluginListResponse {
	/** Core, then simulator, then tool plugins — the registry's load order. */
	items: PluginSummary[];
	total: number;
}

interface TaskArg {
	type: string;
	required: boolean;
	default: unknown;
}

/** One task type's manifest, as declared on disk. */
interface TaskManifest {
	key: string;
	version: string;
	summary: string;
	bound: string;
	side_effect: string;
	args: Record<string, TaskArg>;
	outputs: Record<string, string>;
	requires: string[];
	resources: string[];
	timeout_s: number | null;
	retries: number | null;
}

export interface PluginDetail extends PluginBase {
	/** Names its task types may resolve in a worker — never their values. */
	secrets: string[];
	task_types: TaskManifest[];
	flows: { key: string; version: number; kind: string; description: string }[];
	skills: {
		slug: string;
		name: string;
		version: number;
		when_to_use: string;
		description: string;
	}[];
}

export interface TaskTypeRead extends TaskManifest {
	/** `name@version` of the plugin that declares it. */
	plugin: string;
	/** Run nodes that named this key in the last 30 days. */
	runs_30d: number;
}
