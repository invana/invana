import { Input } from "@invana/forms";
import { Alert, AlertDescription, AlertTitle, Button } from "@invana/ui";
import { AlertTriangle, ShieldAlert, ShieldQuestion } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import {
	useAcknowledgeConnectionVersionMutation,
	useDeclareConnectionVersionMutation,
} from "../../../../hooks/queries/useGraphs";
import { ApiError } from "../../../../services/api/client";
import type { GraphConnectionRead } from "../../../../types/graphs";

interface Props {
	username: string;
	graphSlug: string;
	connection: GraphConnectionRead;
}

/**
 * Backend version-compatibility banner (RFC-022).
 *
 * Renders nothing when the bound DB version is within the connector's tested
 * window. For untested/unsupported/unknown versions it warns the user and offers
 * the appropriate escape hatch — acknowledge-at-risk (untested) or declare-version
 * (unknown). While unacknowledged, writes are blocked server-side and the
 * connection is effectively read-only.
 */
export function CompatibilityBanner({
	username,
	graphSlug,
	connection,
}: Props) {
	const acknowledge = useAcknowledgeConnectionVersionMutation();
	const declare = useDeclareConnectionVersionMutation();
	const [declared, setDeclared] = useState("");

	const status = connection.compatibility_status;
	if (status === "supported") return null;

	const backend = connection.connector_class.split(".").pop() ?? "the database";
	const tested = connection.tested_version_range ?? "the tested range";
	// @invana/ui Alert only ships default|destructive — amber the "warning" states.
	const warnClass =
		"rounded-none border-x-0 border-t-0 border-amber-500/50 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600";

	async function onAcknowledge() {
		try {
			await acknowledge.mutateAsync({ username, graphSlug });
			toast.success("Version acknowledged — writes enabled at your own risk.");
		} catch (err) {
			toast.error(
				err instanceof ApiError
					? err.message
					: "Failed to acknowledge version.",
			);
		}
	}

	async function onDeclare(e: FormEvent) {
		e.preventDefault();
		if (!declared.trim()) return;
		try {
			await declare.mutateAsync({
				username,
				graphSlug,
				serverVersion: declared.trim(),
			});
			toast.success("Server version saved.");
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Failed to save version.",
			);
		}
	}

	if (status === "untested") {
		return (
			<Alert className={warnClass}>
				<AlertTriangle className="h-4 w-4" />
				<AlertTitle>Untested database version</AlertTitle>
				<AlertDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span>
						{backend} {connection.server_version ?? "(unknown)"} is newer than
						Invana's tested range ({tested}). The connection is read-only until
						you continue at your own risk.
					</span>
					<Button
						size="sm"
						variant="outline"
						onClick={onAcknowledge}
						disabled={acknowledge.isPending}
					>
						{acknowledge.isPending
							? "Enabling…"
							: "Acknowledge & enable writes"}
					</Button>
				</AlertDescription>
			</Alert>
		);
	}

	if (status === "unsupported") {
		return (
			<Alert
				variant="destructive"
				className="rounded-none border-x-0 border-t-0"
			>
				<ShieldAlert className="h-4 w-4" />
				<AlertTitle>Unsupported database version</AlertTitle>
				<AlertDescription>
					{backend} {connection.server_version ?? "(unknown)"} is below Invana's
					minimum supported version ({tested}). Writes are blocked — upgrade the
					database to use the modeller against it.
				</AlertDescription>
			</Alert>
		);
	}

	// status === "unknown" — version couldn't be detected (e.g. Gremlin).
	return (
		<Alert className={warnClass}>
			<ShieldQuestion className="h-4 w-4" />
			<AlertTitle>Unknown database version</AlertTitle>
			<AlertDescription className="space-y-2">
				<span>
					Invana couldn't detect {backend}'s version, so the connection is
					read-only. Declare it to enable version-aware property types and
					writes.
				</span>
				<form onSubmit={onDeclare} className="flex items-center gap-2">
					<Input
						value={declared}
						onChange={(e) => setDeclared(e.target.value)}
						placeholder="e.g. 3.7.4"
						className="h-8 w-40"
					/>
					<Button
						type="submit"
						size="sm"
						variant="outline"
						disabled={declare.isPending || !declared.trim()}
					>
						{declare.isPending ? "Saving…" : "Save version"}
					</Button>
				</form>
			</AlertDescription>
		</Alert>
	);
}
