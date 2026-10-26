/**
 * Connections — where this Graph meets the outside. Two tabs:
 *
 * - **This Graph's server** (`/agents/connections/server`, the landing tab) —
 *   the MCP endpoint this Graph offers, what it serves, its recent calls.
 * - **MCP servers** (`/agents/connections/mcp`) — the outside servers whose
 *   tools this Graph's agents call.
 *
 * *Add MCP server* stays in the head on both tabs; adding one moves to *MCP
 * servers* with the new server picked.
 */

import { Button } from "@invana/ui";
import { useAuth } from "@invana-studio/core";
import { DetailStatus } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { NEEDS_INSTALL_ADMIN } from "../plugins/PluginToggle";
import { usePluginsQuery } from "../plugins/queries";
import type { McpServerRead } from "../plugins/types";
import { SectionBody, SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import { AddMcpServerDialog } from "./AddMcpServerDialog";
import { MCP_SERVERS, McpServersTab } from "./McpServersTab";
import { useMcpServerInfoQuery } from "./queries";
import { ThisGraphServerTab } from "./ThisGraphServerTab";

export function ConnectionsSectionPage({
	username,
	graphSlug,
	tab,
	onTab,
}: SectionPageProps) {
	const { isSuperuser } = useAuth();
	const servers = usePluginsQuery(MCP_SERVERS);
	const info = useMcpServerInfoQuery(username, graphSlug);
	const [adding, setAdding] = useState(false);
	const [picked, setPicked] = useState<string | null>(null);
	const [changed, setChanged] = useState<McpServerRead | null>(null);
	const onServers = tab === "mcp";

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

	const chips = onServers ? (
		servers.data ? (
			<DetailStatus>{`${servers.data.total} servers`}</DetailStatus>
		) : null
	) : info.data ? (
		<DetailStatus>
			{`${info.data.agents_served} agents · ${info.data.functions_served} functions served`}
		</DetailStatus>
	) : null;

	return (
		<SectionPage
			section="connections"
			tab={tab}
			onTab={onTab}
			chips={chips}
			actions={addButton}
		>
			<SectionBody>
				{onServers ? (
					<McpServersTab
						addButton={addButton}
						changed={changed}
						onChanged={setChanged}
						picked={picked}
						onPick={setPicked}
					/>
				) : (
					<ThisGraphServerTab username={username} graphSlug={graphSlug} />
				)}
			</SectionBody>
			{adding ? (
				<AddMcpServerDialog
					onClose={() => setAdding(false)}
					onAdded={(server) => {
						setAdding(false);
						setChanged(server);
						setPicked(server.plugin);
						onTab("mcp");
					}}
				/>
			) : null}
		</SectionPage>
	);
}
