/**
 * Approvals › Alert rules: rules over the ledger — writes to a type, secrets
 * out of place, refusal spikes, access granted, third-party reads — as one
 * table, On · When · Matches · Notifies · Last fired. The switch turns a rule
 * on or off in place; a row opens it to edit or delete; *New alert* opens an
 * empty one. A match tells each named member in the inbox.
 *
 * Writing a rule is the Graph's `settings` area. Without it the tab reads:
 * a notice names the role and who holds it, *New alert* and each switch are
 * disabled with that reason, and a row does not open.
 */

import { Switch } from "@invana/forms";
import {
	EmptyState,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { formatRelativeTime } from "@invana-studio/core";
import { ActButton, ReadOnlyNotice, useAccess } from "@invana-studio/shell";
import { FormError } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { FleetReadState } from "../overview/fleetParts";
import { AlertRuleDialog } from "./AlertRuleDialog";
import { useAlertRuleMutations, useAlertRulesQuery } from "./queries";
import type { AlertRule } from "./types";

export function AlertRulesTab({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const rules = useAlertRulesQuery(username, graphSlug);
	const { update } = useAlertRuleMutations({ username, graphSlug });
	// `null` is closed; `"new"` is *New alert*; a rule is that rule open.
	const [editing, setEditing] = useState<AlertRule | "new" | null>(null);
	const items = rules.data?.items ?? [];
	const settings = useAccess().gate("settings");
	const may = settings.allowed;

	const newAlert = (
		<ActButton
			area="settings"
			variant="outline"
			size="sm"
			onClick={() => setEditing("new")}
		>
			<Plus />
			New alert
		</ActButton>
	);

	return (
		<div className="flex flex-col gap-3">
			<ReadOnlyNotice area="settings" noun="list" />
			{items.length > 0 && <div className="flex justify-end">{newAlert}</div>}
			<FormError error={update.error} />
			{!rules.data ? (
				<FleetReadState
					loading={rules.isLoading}
					error={rules.error}
					what="the alert rules"
				/>
			) : items.length === 0 ? (
				<EmptyState
					title="No alert rules yet"
					description="An alert tells members when a ledger row matches — a write to a type, a refusal spike, access granted."
					actions={newAlert}
				/>
			) : (
				<div className="rounded-sm border">
					<Table density="compact">
						<TableHeader>
							<TableRow>
								<TableHead>On</TableHead>
								<TableHead>When</TableHead>
								<TableHead>Matches</TableHead>
								<TableHead>Notifies</TableHead>
								<TableHead>Last fired</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((rule) => (
								<TableRow
									key={rule.id}
									className={may ? "cursor-pointer" : undefined}
									onClick={may ? () => setEditing(rule) : undefined}
								>
									<TableCell onClick={(e) => e.stopPropagation()}>
										<Switch
											aria-label={`${rule.name} on`}
											checked={rule.enabled}
											disabled={!may || update.isPending}
											title={may ? undefined : (settings.reason ?? undefined)}
											aria-description={
												may ? undefined : (settings.reason ?? undefined)
											}
											onCheckedChange={(on) =>
												update.mutate({ id: rule.id, data: { enabled: on } })
											}
										/>
									</TableCell>
									<TableCell className="font-medium">{rule.name}</TableCell>
									<TableCell className="text-muted-foreground">
										{rule.match_line || "any row"}
									</TableCell>
									<TableCell>{rule.notify_line || "—"}</TableCell>
									<TableCell className="whitespace-nowrap text-muted-foreground">
										{rule.last_fired_at
											? formatRelativeTime(new Date(rule.last_fired_at))
											: "never"}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
			{editing && (
				<AlertRuleDialog
					username={username}
					graphSlug={graphSlug}
					rule={editing === "new" ? undefined : editing}
					onClose={() => setEditing(null)}
				/>
			)}
		</div>
	);
}
