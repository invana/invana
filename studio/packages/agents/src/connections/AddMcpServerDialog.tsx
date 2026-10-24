/**
 * *Add MCP server* — an install Admin names a server and its Streamable HTTP
 * URL; the engine connects, lists its tools and freezes them as revision 1 of
 * `invana.mcp.<name>`. It is added disabled, and each tool becomes a function
 * named `mcp.<name>.<tool>` once every process restarts.
 *
 * The bearer token is never typed here: it is read from
 * `INVANA_SECRET_MCP_<NAME>` on the API (for the add) and on the workers that
 * call it. A refused add — a bad name, a taken one, an unreachable server —
 * shows the engine's reason in place.
 */

import { Field, FieldDescription, FieldLabel, Input } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { useState } from "react";
import { useAddMcpServerMutation } from "../plugins/queries";
import type { McpServerRead } from "../plugins/types";

/** The variable a server's bearer token is read from — the documented convention. */
export const credentialOf = (server: string): string =>
	`INVANA_SECRET_MCP_${server.toUpperCase()}`;

/** Mounted only while it is open. */
export function AddMcpServerDialog({
	onClose,
	onAdded,
}: {
	onClose: () => void;
	onAdded: (server: McpServerRead) => void;
}) {
	const add = useAddMcpServerMutation();
	const [name, setName] = useState("");
	const [url, setUrl] = useState("");
	const server = name.trim();

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Add an MCP server</DialogTitle>
					<DialogDescription>
						Its tools become functions — called like any other, governed like
						any other.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="grid gap-3 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="mcp-name">Name</FieldLabel>
							<Input
								id="mcp-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="figma"
							/>
							<FieldDescription>
								Lower case, digits and _, up to 32.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="mcp-url">Server URL</FieldLabel>
							<Input
								id="mcp-url"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								placeholder="https://mcp.example.com/mcp"
							/>
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor="mcp-credential">Credential</FieldLabel>
						<Input
							id="mcp-credential"
							className="font-mono"
							value={credentialOf(server || "<name>")}
							readOnly
						/>
						<FieldDescription>
							A bearer token set on the workers that call it. Invana never
							stores or shows it.
						</FieldDescription>
					</Field>
					<FieldDescription>
						It is added disabled, with its tool list frozen: a change on the
						server's side reaches no plan until you refresh it. Enable it once
						you have read its tools.
					</FieldDescription>
					<FormError error={add.error} />
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!server || !url.trim() || add.isPending}
						onClick={() =>
							add.mutate(
								{ name: server, url: url.trim() },
								{ onSuccess: onAdded },
							)
						}
					>
						{add.isPending ? "Connecting…" : "Add · disabled"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
