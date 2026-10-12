/**
 * Activity › Rules — which events reach whom, on which channel.
 *
 * A centred column: a *Rules* header with the count and *New rule*, then one
 * row per rule — its name; *when* its events (as code) and what they match,
 * or *any product*; who hears; a badge for In app and for each channel it
 * delivers on; and a switch that enables or disables it in place. The row's
 * name opens the rule's dialog. With no rules, an empty state offers *New
 * rule*.
 *
 * `?new=1` opens *New rule* on arrival — the Inbox's empty state links here
 * that way — and the parameter is cleared when the dialog closes, so a reload
 * does not reopen it.
 */

import { Switch } from "@invana/forms";
import {
	Badge,
	EmptyState,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
	SectionHeader,
	Spinner,
	TypographyInlineCode,
} from "@invana/ui";
import type { GraphRef } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { ListChecks, Plus } from "lucide-react";
import { Fragment, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ActButton } from "../../../access/ActButton";
import { useAccess } from "../../../access/useAccess";
import { refusalOf } from "../api";
import {
	useChannelsQuery,
	useMemberName,
	useRulesQuery,
	useUpdateRule,
} from "../queries";
import type { NotificationRule } from "../types";
import { RuleDialog } from "./RuleDialog";
import { audienceText, matchText } from "./ruleText";

type Open = { mode: "new" } | { mode: "edit"; rule: NotificationRule } | null;

/** The Graph's notification rules, and the dialog that writes them. */
export function RulesTab({ graph }: { graph: GraphRef }) {
	const rules = useRulesQuery(graph);
	const [params, setParams] = useSearchParams();
	const [open, setOpen] = useState<Open>(null);
	const fromLink = params.get("new") === "1";
	const dialog: Open = open ?? (fromLink ? { mode: "new" } : null);

	const close = () => {
		setOpen(null);
		if (fromLink)
			setParams(
				(p) => {
					p.delete("new");
					return p;
				},
				{ replace: true },
			);
	};
	const newRule = () => setOpen({ mode: "new" });
	const items = rules.data?.items ?? [];

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-2 p-4">
				<SectionHeader
					bare
					title="Rules"
					count={rules.data?.total}
					actions={
						<ActButton area="settings" size="sm" onClick={newRule}>
							<Plus />
							New rule
						</ActButton>
					}
				/>
				{rules.isLoading ? (
					<Spinner />
				) : rules.error ? (
					<FormError error={refusalOf(rules.error)} />
				) : items.length === 0 ? (
					<EmptyState
						icon={<ListChecks className="size-6" />}
						title="No rules yet"
						description="A rule tells people when something happens on this Graph — a run fails, an approval waits — in the Inbox or on a channel."
						actions={
							<ActButton area="settings" size="sm" onClick={newRule}>
								<Plus />
								New rule
							</ActButton>
						}
					/>
				) : (
					<ItemGroup className="gap-2">
						{items.map((rule) => (
							<RuleRow
								key={rule.id}
								graph={graph}
								rule={rule}
								onOpen={() => setOpen({ mode: "edit", rule })}
							/>
						))}
					</ItemGroup>
				)}
			</div>
			{dialog && (
				<RuleDialog
					key={dialog.mode === "edit" ? dialog.rule.id : "new"}
					graph={graph}
					rule={dialog.mode === "edit" ? dialog.rule : undefined}
					onClose={close}
				/>
			)}
		</div>
	);
}

/** One rule: what fires it, who hears, where, and whether it is on. */
function RuleRow({
	graph,
	rule,
	onOpen,
}: {
	graph: GraphRef;
	rule: NotificationRule;
	onOpen: () => void;
}) {
	const nameOf = useMemberName(graph);
	const channels = useChannelsQuery(graph).data?.items ?? [];
	const update = useUpdateRule(graph);
	const settings = useAccess().gate("settings");
	const on = rule.channel_ids.map(
		(id) => channels.find((c) => c.id === id)?.name ?? "a removed channel",
	);

	return (
		<Item variant="outline" size="sm" dim={!rule.enabled}>
			<ItemContent>
				<button type="button" className="text-left" onClick={onOpen}>
					<ItemTitle>{rule.name}</ItemTitle>
				</button>
				<ItemDescription>
					when{" "}
					{rule.events.map((e, i) => (
						<Fragment key={e}>
							{i > 0 && ", "}
							<TypographyInlineCode>{e}</TypographyInlineCode>
						</Fragment>
					))}{" "}
					{matchText(rule.match)} · {audienceText(rule, nameOf)}
				</ItemDescription>
			</ItemContent>
			<ItemActions>
				{rule.in_app && (
					<Badge variant="outline" tone="muted">
						In app
					</Badge>
				)}
				{on.map((name, i) => (
					<Badge key={rule.channel_ids[i]} variant="outline" tone="muted">
						{name}
					</Badge>
				))}
				<Switch
					aria-label={`${rule.name} enabled`}
					checked={rule.enabled}
					disabled={update.isPending || !settings.allowed}
					title={settings.reason ?? undefined}
					aria-description={settings.reason ?? undefined}
					onCheckedChange={(enabled) =>
						update.mutate({ id: rule.id, body: { enabled } })
					}
				/>
			</ItemActions>
			{update.error ? (
				<FormError className="basis-full" error={refusalOf(update.error)} />
			) : null}
		</Item>
	);
}
