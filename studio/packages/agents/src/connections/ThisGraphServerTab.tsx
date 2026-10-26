/**
 * Connections › **This Graph's server** (board `agents.connections`) — the MCP
 * endpoint this Graph offers, what it serves and the calls it has answered.
 *
 * *As a builder or data owner, I want Claude Code, or any MCP client, to use
 * this Graph — check records, push a draft dataset, ask an agent — so that
 * data arrives without Invana pulling it, and a person still publishes.*
 *
 * - **Endpoint** and **Use it from Claude Code** — the URL and the
 *   `claude mcp add` line, both built by the engine (`GET …/connections/server`).
 * - **What it serves** — every live agent and the served functions, each with
 *   its tool name and a Served switch (`PUT …/served/{kind}/{ref}`). Everything
 *   starts off; a member without *build* sees the switches disabled.
 * - **Recent calls** — each call is a run; its result line is the one the
 *   engine stored when the run settled. A row opens its run.
 */

import { CodeBlock } from "@invana/editor";
import { Switch } from "@invana/forms";
import {
	Badge,
	Button,
	PropertyList,
	PropertyRow,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { formatShortDateTime } from "@invana-studio/core";
import { useAccess } from "@invana-studio/shell";
import { FormError, PanelSection } from "@invana-studio/ui";
import { RowsFailed, RowsLoading } from "../functions/shared";
import { useAgentsOpen } from "../open";
import {
	useMcpCallsQuery,
	useMcpServerInfoQuery,
	useServedQuery,
	useSetServedMutation,
} from "./queries";

export function ThisGraphServerTab({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const info = useMcpServerInfoQuery(username, graphSlug);
	return (
		<>
			<div className="grid gap-2.5 lg:grid-cols-2">
				<PanelSection card title="Endpoint">
					{info.isLoading ? (
						<RowsLoading />
					) : info.isError || !info.data ? (
						<RowsFailed what="The endpoint" error={info.error} />
					) : (
						<PropertyList labelWidth={130}>
							<PropertyRow label="URL">
								<span className="break-all font-mono">{info.data.url}</span>
							</PropertyRow>
							<PropertyRow label="Transport">{info.data.transport}</PropertyRow>
							<PropertyRow label="Who may connect">
								anyone with a token — made in IAM; its policy decides what they
								may call
							</PropertyRow>
							<PropertyRow label="Each call">
								a run, as the caller ∩ the agent — in the ledger like any other
							</PropertyRow>
						</PropertyList>
					)}
				</PanelSection>
				<PanelSection card title="Use it from Claude Code">
					{info.data ? (
						<CodeBlock value={info.data.connect_command} language="shell" />
					) : info.isLoading ? (
						<RowsLoading />
					) : null}
				</PanelSection>
			</div>
			<Served username={username} graphSlug={graphSlug} />
			<RecentCalls username={username} graphSlug={graphSlug} />
		</>
	);
}

function Served({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const served = useServedQuery(username, graphSlug);
	const flip = useSetServedMutation(username, graphSlug);
	const build = useAccess().gate("build");
	const rows = served.data?.items ?? [];
	return (
		<PanelSection card title="What it serves">
			<FormError error={flip.error} />
			{served.isLoading ? (
				<RowsLoading />
			) : served.isError ? (
				<RowsFailed what="What it serves" error={served.error} />
			) : rows.length === 0 ? (
				<p className="text-muted-foreground">
					No live agent or servable function in this Graph yet.
				</p>
			) : (
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Kind</TableHead>
							<TableHead>Name</TableHead>
							<TableHead>Tool</TableHead>
							<TableHead className="w-full">What it does</TableHead>
							<TableHead>Served</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((r) => (
							<TableRow key={`${r.kind}:${r.ref}`}>
								<TableCell>
									<Badge variant="outline" tone="muted" size="xs">
										{r.kind === "agent" ? "Agent" : "Function"}
									</Badge>
								</TableCell>
								<TableCell
									className={
										r.kind === "agent"
											? "whitespace-nowrap font-medium"
											: "whitespace-nowrap font-mono"
									}
								>
									{r.name}
								</TableCell>
								<TableCell className="whitespace-nowrap font-mono">
									{r.tool}
								</TableCell>
								<TableCell className="whitespace-normal text-muted-foreground">
									{r.does}
								</TableCell>
								<TableCell>
									<Switch
										aria-label={`Serve ${r.tool}`}
										checked={r.served}
										disabled={!build.allowed || flip.isPending}
										title={build.reason ?? undefined}
										onCheckedChange={(on) =>
											flip.mutate({ kind: r.kind, ref: r.ref, served: on })
										}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</PanelSection>
	);
}

function RecentCalls({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const open = useAgentsOpen();
	const calls = useMcpCallsQuery(username, graphSlug);
	const rows = calls.data?.items ?? [];
	return (
		<PanelSection card title="Recent calls">
			{calls.isLoading ? (
				<RowsLoading />
			) : calls.isError ? (
				<RowsFailed what="The recent calls" error={calls.error} />
			) : rows.length === 0 ? (
				<p className="text-muted-foreground">
					No calls yet — connect with the line above and a token made in IAM.
				</p>
			) : (
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>When</TableHead>
							<TableHead>Caller</TableHead>
							<TableHead>Token</TableHead>
							<TableHead>Tool</TableHead>
							<TableHead className="w-full">Result</TableHead>
							<TableHead>Run</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((c) => (
							<TableRow key={c.run_id}>
								<TableCell className="whitespace-nowrap text-muted-foreground">
									{formatShortDateTime(new Date(c.at))}
								</TableCell>
								<TableCell className="whitespace-nowrap">
									{`${c.caller} ▸ ${c.client}`}
								</TableCell>
								<TableCell className="whitespace-nowrap font-mono">
									{c.token ?? "—"}
								</TableCell>
								<TableCell className="whitespace-nowrap font-mono">
									{c.tool}
								</TableCell>
								<TableCell
									className={
										c.status === "succeeded"
											? "whitespace-normal"
											: "whitespace-normal text-destructive"
									}
								>
									{c.result ?? c.status}
								</TableCell>
								<TableCell>
									<Button
										size="sm"
										variant="link"
										className="font-mono"
										onClick={() => open.run(c.run_id)}
									>
										{c.number ? `#${c.number}` : "open"}
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</PanelSection>
	);
}
