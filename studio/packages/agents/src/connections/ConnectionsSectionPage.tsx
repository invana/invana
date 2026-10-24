/**
 * Connections › MCP servers — every MCP server an install Admin added, and the
 * selected server's tools as the functions they become.
 *
 * *As a builder, I want to see which outside servers my agents may call, what
 * each one's tools read or send, and where its credential lives, so that I
 * know what an agent reaches beyond this Graph.*
 *
 * The rows are the registry's MCP plugins (`GET /api/v1/plugins?kind=mcp`);
 * the selected server's tools are its plugin's task types, each `read` or
 * `send` — a send waits on an approval. A server's credential is the name of
 * the variable its bearer token is read from, never the token. Enabling,
 * disabling, refreshing the frozen tools and adding a server are an install
 * Admin's acts; anyone else sees them drawn disabled. An add or a refresh
 * takes effect once each process restarts, and the page says so.
 */

import {
	Alert,
	AlertDescription,
	Button,
	EmptyState,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useAuth } from "@invana-studio/core";
import { DetailStatus, FormError, PanelSection } from "@invana-studio/ui";
import { Plug, Plus, RefreshCw, SquareFunction } from "lucide-react";
import { useState } from "react";
import { RowsFailed, RowsLoading } from "../functions/shared";
import { PAGE } from "../lists";
import { useAgentsOpen } from "../open";
import {
	NEEDS_INSTALL_ADMIN,
	PluginStateChip,
	PluginToggle,
} from "../plugins/PluginToggle";
import {
	usePluginQuery,
	usePluginsQuery,
	useRefreshMcpServerMutation,
} from "../plugins/queries";
import type { McpServerRead, PluginSummary } from "../plugins/types";
import { SectionBody, SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import { AddMcpServerDialog, credentialOf } from "./AddMcpServerDialog";

const MCP = { filters: { kind: ["mcp"] }, limit: PAGE };

/** `invana.mcp.figma` → `figma`. */
const serverOf = (p: PluginSummary): string =>
	p.title || p.name.replace(/^invana\.mcp\./, "");

export function ConnectionsSectionPage({ tab, onTab }: SectionPageProps) {
	const open = useAgentsOpen();
	const { isSuperuser } = useAuth();
	const servers = usePluginsQuery(MCP);
	const refresh = useRefreshMcpServerMutation();
	const [adding, setAdding] = useState(false);
	const [picked, setPicked] = useState<string | null>(null);
	const [changed, setChanged] = useState<McpServerRead | null>(null);

	const rows = servers.data?.items ?? [];
	const selected = rows.find((p) => p.name === picked) ?? rows[0] ?? null;

	const addButton = (
		<Button
			size="sm"
			variant="outline"
			disabled={!isSuperuser}
			title={isSuperuser ? undefined : NEEDS_INSTALL_ADMIN}
			onClick={() => setAdding(true)}
		>
			<Plus />
			Add MCP server
		</Button>
	);

	return (
		<SectionPage
			section="connections"
			tab={tab}
			onTab={onTab}
			chips={
				servers.data ? (
					<DetailStatus>{`${servers.data.total} servers`}</DetailStatus>
				) : null
			}
			actions={addButton}
		>
			<SectionBody>
				<Alert tone="info">
					<Plug className="size-4" />
					<AlertDescription className="flex flex-wrap items-center gap-2">
						<span className="flex-1">
							A server's tools become functions named{" "}
							<span className="font-mono">mcp.&lt;server&gt;.&lt;tool&gt;</span>{" "}
							— listed in Functions, needed by skills, granted by policies.
						</span>
						<Button
							size="sm"
							variant="outline"
							onClick={() => open.section("functions")}
						>
							<SquareFunction />
							Open in Functions
						</Button>
					</AlertDescription>
				</Alert>
				{changed ? (
					<Alert tone="success">
						<AlertDescription>
							<span className="font-mono">{changed.name}</span> is at revision{" "}
							{changed.revision} with {changed.tools.length} tools, frozen{" "}
							{new Date(changed.frozen_at).toLocaleString()}
							{changed.restart_required
								? " — restart the API and the workers to load it."
								: "."}
						</AlertDescription>
					</Alert>
				) : null}
				<FormError error={refresh.error} />
				{servers.isLoading ? (
					<RowsLoading />
				) : servers.isError ? (
					<RowsFailed what="The MCP servers" error={servers.error} />
				) : rows.length === 0 ? (
					<EmptyState
						icon={<Plug className="size-6" />}
						title="No MCP servers"
						description="Add one by name and URL; its tools become functions, added disabled."
						actions={addButton}
					/>
				) : (
					<>
						<Table density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Server</TableHead>
									<TableHead className="w-full">Plugin</TableHead>
									<TableHead>Revision</TableHead>
									<TableHead className="text-right">Tools</TableHead>
									<TableHead className="whitespace-nowrap">
										Credential on the workers
									</TableHead>
									<TableHead>State</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((p) => (
									<TableRow
										key={p.name}
										className="cursor-pointer"
										data-state={
											p.name === selected?.name ? "selected" : undefined
										}
										onClick={() => setPicked(p.name)}
									>
										<TableCell className="font-mono">{serverOf(p)}</TableCell>
										<TableCell className="font-mono text-muted-foreground">
											{p.name}
										</TableCell>
										<TableCell>{p.version}</TableCell>
										<TableCell className="text-right">{p.task_types}</TableCell>
										<TableCell className="whitespace-nowrap font-mono">
											{credentialOf(serverOf(p))}
										</TableCell>
										<TableCell>
											<PluginStateChip plugin={p} />
										</TableCell>
										<TableCell className="whitespace-nowrap">
											<span className="flex items-center gap-1">
												<PluginToggle plugin={p} />
												<Button
													size="sm"
													variant="ghost"
													disabled={!isSuperuser || refresh.isPending}
													title={isSuperuser ? undefined : NEEDS_INSTALL_ADMIN}
													onClick={(e) => {
														e.stopPropagation();
														refresh.mutate(serverOf(p), {
															onSuccess: setChanged,
														});
													}}
												>
													<RefreshCw />
													Refresh tools
												</Button>
											</span>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						{selected ? <ServerTools plugin={selected} /> : null}
					</>
				)}
			</SectionBody>
			{adding ? (
				<AddMcpServerDialog
					onClose={() => setAdding(false)}
					onAdded={(server) => {
						setAdding(false);
						setChanged(server);
						setPicked(server.plugin);
					}}
				/>
			) : null}
		</SectionPage>
	);
}

/** `FIGMA · ITS TOOLS` — each tool, the function it becomes, and what it does to the world. */
function ServerTools({ plugin }: { plugin: PluginSummary }) {
	const open = useAgentsOpen();
	const detail = usePluginQuery(plugin.name);
	const server = serverOf(plugin);
	const tools = detail.data?.task_types ?? [];
	return (
		<PanelSection card title={`${server} · its tools`}>
			{detail.isLoading ? (
				<RowsLoading />
			) : detail.isError ? (
				<RowsFailed what="Its tools" error={detail.error} />
			) : tools.length === 0 ? (
				<p className="text-muted-foreground">
					{plugin.restart_required || !plugin.installed
						? "Its tools load once the API and the workers restart."
						: "It lists no tools."}
				</p>
			) : (
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Tool</TableHead>
							<TableHead>Function</TableHead>
							<TableHead className="w-full">What it does</TableHead>
							<TableHead className="whitespace-nowrap">Side effect</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{tools.map((t) => (
							<TableRow
								key={t.key}
								className="cursor-pointer"
								onClick={() => open.func(t.key)}
							>
								<TableCell className="font-mono">
									{t.key.replace(`mcp.${server}.`, "")}
								</TableCell>
								<TableCell className="whitespace-nowrap font-mono">
									{t.key}
								</TableCell>
								<TableCell>{t.summary}</TableCell>
								<TableCell className="whitespace-nowrap">
									{t.side_effect === "read" ? (
										"read"
									) : (
										<DetailStatus tone="warning">
											{`${t.side_effect} · approval`}
										</DetailStatus>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</PanelSection>
	);
}
