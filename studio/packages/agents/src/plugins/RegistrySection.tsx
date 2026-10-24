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
import type { ListUrl } from "@invana-studio/core";
import {
	RecordRow,
	type StackSectionUi,
	stackSection,
} from "@invana-studio/ui";
import { Puzzle } from "lucide-react";
import {
	chipsOf,
	FilteredEmpty,
	filterValue,
	ListStrip,
	matchCount,
	PAGE,
	setOne,
} from "../lists";
import { usePluginsQuery } from "./queries";
import type { PluginSummary } from "./types";

const KINDS = [
	{ value: "all", label: "All" },
	{ value: "core", label: "Core" },
	{ value: "tool", label: "Tool" },
	{ value: "mcp", label: "MCP" },
	{ value: "simulator", label: "Simulator" },
];

/** The page of plugins the URL asks for — the header's count and the rows read one query. */
const usePluginList = (list: ListUrl) =>
	usePluginsQuery({ ...list.query, limit: PAGE });

export function registrySection({
	ui,
	list,
	onOpenPlugin,
	defaultSize,
}: {
	ui: StackSectionUi;
	/** The URL's search and filters — the controls write them, the rows are the engine's answer. */
	list: ListUrl;
	onOpenPlugin?: (name: string) => void;
	defaultSize?: number | string;
}): PanelStackSection {
	return stackSection(
		{
			id: "plugins",
			label: "Plugins",
			icon: Puzzle,
			count: <RegistryCount list={list} />,
			searchable: true,
			searchPlaceholder: "Search plugins",
			defaultSize,
			children: () => <RegistryBody list={list} onOpenPlugin={onOpenPlugin} />,
		},
		ui,
	);
}

function RegistryCount({ list }: { list: ListUrl }) {
	const page = usePluginList(list).data;
	return page?.unfiltered_total ? matchCount(page) : null;
}

/** `enabled` · `disabled` · `not installed` · `restart to load`. */
function stateOf(p: PluginSummary): string {
	if (!p.installed) return "not installed";
	if (p.restart_required) return "restart to load";
	return p.enabled ? "enabled" : "disabled";
}

function RegistryBody({
	list,
	onOpenPlugin,
}: {
	list: ListUrl;
	onOpenPlugin?: (name: string) => void;
}) {
	const plugins = usePluginList(list);

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

	const rows = plugins.data?.items ?? [];
	const chips = chipsOf(plugins.data, list);

	return (
		<div className="flex h-full flex-col">
			<div className="px-3 pt-2 pb-1">
				{/* A preset of the `kind` filter: picking one shows as its chip. */}
				<SegmentedControl
					size="xs"
					options={KINDS}
					value={filterValue(list, "kind") || "all"}
					onValueChange={(v) => setOne(list, "kind", v === "all" ? "" : v)}
					aria-label="Kind"
				/>
			</div>
			<ListStrip page={plugins.data} list={list} />
			<div className="min-h-0 flex-1 overflow-y-auto pb-2">
				{rows.length === 0 ? (
					chips.length ? (
						<FilteredEmpty noun="plugin" filters={chips} onClear={list.clear} />
					) : (
						<p className="px-3 py-4 text-muted-foreground">
							This install loaded no plugins.
						</p>
					)
				) : (
					rows.map((p) => (
						<RecordRow
							key={p.name}
							onClick={() => onOpenPlugin?.(p.name)}
							title={<span className="font-mono">{p.name}</span>}
							subtitle={`${p.kind} · v${p.version} · ${p.task_types} function${p.task_types === 1 ? "" : "s"}`}
							status={stateOf(p)}
						/>
					))
				)}
			</div>
		</div>
	);
}
