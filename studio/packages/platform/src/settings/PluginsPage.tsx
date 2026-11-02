/**
 * Settings › Plugins — the install's plugin registry, one row per plugin:
 * its kind, version, how many functions it declares and whether it may run.
 *
 * The rows are the engine's registry, searched (name and title) and filtered
 * by kind there. Enabling or disabling a tool or MCP plugin is an install
 * Admin's act, taken on the row; a core plugin always runs. A row opens the
 * plugin's page as a tab beside this one.
 */

import {
	SearchInput,
	SegmentedControl,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useListParams, usePluginsQuery } from "@invana-studio/core";
import {
	FilteredEmpty,
	filterValue,
	ListStrip,
	PAGE,
	PluginStateChip,
	PluginToggle,
	ReadState,
	setOne,
	useOpenPlatformRecord,
} from "@invana-studio/shell";
import { DetailStatus, SectionBody, SectionFrame } from "@invana-studio/ui";
import { useSearchParams } from "react-router-dom";
import { PLUGINS } from "./section";

const KINDS = [
	{ value: "all", label: "All" },
	{ value: "core", label: "Core" },
	{ value: "tool", label: "Tool" },
	{ value: "mcp", label: "MCP" },
	{ value: "simulator", label: "Simulator" },
];

const FIELDS = ["kind", "enabled"];

export function PluginsPage() {
	const openRecord = useOpenPlatformRecord();
	const list = useListParams();
	const [params] = useSearchParams();
	const search = params.get("q") ?? "";
	const filters = Object.fromEntries(
		Object.entries(list.query.filters ?? {}).filter(([f]) =>
			FIELDS.includes(f),
		),
	);
	const plugins = usePluginsQuery({ q: list.query.q, filters, limit: PAGE });
	const rows = plugins.data?.items ?? [];

	return (
		<SectionFrame
			{...PLUGINS}
			chips={
				plugins.data ? (
					<DetailStatus>{`${plugins.data.unfiltered_total} plugins`}</DetailStatus>
				) : null
			}
		>
			<SectionBody>
				<div className="flex flex-col gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<SearchInput
							inputSize="sm"
							value={search}
							onChange={list.setQ}
							placeholder="Find a plugin"
							className="w-72"
						/>
						{/* A preset of the `kind` filter: picking one shows as its chip. */}
						<SegmentedControl
							size="xs"
							options={KINDS}
							value={filterValue(list, "kind") || "all"}
							onValueChange={(v) => setOne(list, "kind", v === "all" ? "" : v)}
							aria-label="Kind"
						/>
						<span className="ml-auto text-muted-foreground">
							Installed on the engine and the workers · switched by an install
							Admin
						</span>
					</div>
					<ListStrip page={plugins.data} list={list} />
					{plugins.isLoading || plugins.isError ? (
						<ReadState
							loading={plugins.isLoading}
							error={plugins.error}
							what="the plugins"
						/>
					) : rows.length === 0 ? (
						plugins.data?.applied.length ? (
							<FilteredEmpty
								noun="plugin"
								filters={plugins.data.applied}
								onClear={list.clear}
							/>
						) : (
							<p className="p-3 text-muted-foreground">
								This install loaded no plugins.
							</p>
						)
					) : (
						<Table density="compact">
							<TableHeader>
								<TableRow>
									<TableHead className="w-full">Plugin</TableHead>
									<TableHead>Kind</TableHead>
									<TableHead>Version</TableHead>
									<TableHead className="text-right">Functions</TableHead>
									<TableHead>State</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((p) => (
									<TableRow
										key={p.name}
										className="cursor-pointer"
										onClick={() => openRecord("plugin", p.name)}
									>
										<TableCell className="font-mono">{p.name}</TableCell>
										<TableCell>
											<DetailStatus>{p.kind}</DetailStatus>
										</TableCell>
										<TableCell>{p.version}</TableCell>
										<TableCell className="text-right">{p.task_types}</TableCell>
										<TableCell>
											<PluginStateChip plugin={p} />
										</TableCell>
										<TableCell className="whitespace-nowrap">
											<PluginToggle plugin={p} />
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</div>
			</SectionBody>
		</SectionFrame>
	);
}
