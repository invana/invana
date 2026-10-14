/**
 * **Plugins** — the first section of the Plugins stack: the install's plugin
 * registry, one row per plugin with its kind, version, task types and state.
 *
 * *As a builder, I want to see every plugin this install loaded and what each
 * brings, so that I know which task types a plan can name before I write one.*
 *
 * The rows are the engine's registry in its load order — core, then
 * simulator, then tool and MCP plugins. A row opens the plugin's page beside
 * the section; enabling one is an install Admin's act, taken there.
 */

import {
	EmptyState,
	type PanelStackSection,
	SegmentedControl,
	Spinner,
} from "@invana/ui";
import {
	RecordRow,
	type StackSectionUi,
	stackSection,
} from "@invana-studio/ui";
import { Puzzle } from "lucide-react";
import { useState } from "react";
import { usePluginsQuery } from "./queries";
import type { PluginSummary } from "./types";

const KINDS = [
	{ value: "all", label: "All" },
	{ value: "core", label: "Core" },
	{ value: "tool", label: "Tool" },
	{ value: "mcp", label: "MCP" },
	{ value: "simulator", label: "Simulator" },
];

export function registrySection({
	ui,
	onOpenPlugin,
	defaultSize,
}: {
	ui: StackSectionUi;
	onOpenPlugin?: (name: string) => void;
	defaultSize?: number | string;
}): PanelStackSection {
	return stackSection(
		{
			id: "plugins",
			label: "Plugins",
			icon: Puzzle,
			count: <RegistryCount />,
			searchable: true,
			searchPlaceholder: "Search plugins",
			defaultSize,
			children: ({ search }) => (
				<RegistryBody search={search} onOpenPlugin={onOpenPlugin} />
			),
		},
		ui,
	);
}

function RegistryCount() {
	const total = usePluginsQuery().data?.total;
	return total || null;
}

/** `enabled` · `disabled` · `not installed` · `restart to load`. */
function stateOf(p: PluginSummary): string {
	if (!p.installed) return "not installed";
	if (p.restart_required) return "restart to load";
	return p.enabled ? "enabled" : "disabled";
}

function RegistryBody({
	search,
	onOpenPlugin,
}: {
	search: string;
	onOpenPlugin?: (name: string) => void;
}) {
	const plugins = usePluginsQuery();
	const [kind, setKind] = useState("all");

	if (plugins.isLoading)
		return (
			<div className="px-3 py-4">
				<Spinner />
			</div>
		);
	if (plugins.isError)
		return (
			<EmptyState
				className="px-3 py-4"
				title="The registry did not load"
				description="The engine did not answer. Reopen the section to try again."
			/>
		);

	const q = search.toLowerCase();
	const rows = (plugins.data?.items ?? []).filter(
		(p) =>
			(kind === "all" || p.kind === kind) &&
			[p.name, p.title].some((s) => s.toLowerCase().includes(q)),
	);

	return (
		<div className="flex h-full flex-col">
			<div className="px-3 pt-2 pb-1">
				<SegmentedControl
					size="xs"
					options={KINDS}
					value={kind}
					onValueChange={setKind}
					aria-label="Kind"
				/>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto pb-2">
				{rows.length === 0 ? (
					<p className="px-3 py-4 text-muted-foreground">
						No plugin matches that.
					</p>
				) : (
					rows.map((p) => (
						<RecordRow
							key={p.name}
							onClick={() => onOpenPlugin?.(p.name)}
							title={<span className="font-mono">{p.name}</span>}
							subtitle={`${p.kind} · v${p.version} · ${p.task_types} task type${p.task_types === 1 ? "" : "s"}`}
							status={stateOf(p)}
						/>
					))
				)}
			</div>
		</div>
	);
}
