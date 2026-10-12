/**
 * Activity › Channels — in app, email, Slack and webhook.
 *
 * A centred column under a *Channels* header with the count and *Add
 * channel*:
 *
 * | Row | Reads | Act |
 * |---|---|---|
 * | In app | the Inbox and the bell · always on | — |
 * | each channel | name · kind and its masked target · *ready*, or why not | *Remove*, after a confirm |
 * | Microsoft Teams | not connected | — |
 *
 * A channel a rule or schedule still uses cannot be removed: the engine
 * refuses and names them, and the row shows that reason. Under the list, a
 * note says what the channels are for.
 */

import {
	Badge,
	Button,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
	SectionHeader,
	Spinner,
} from "@invana/ui";
import type { GraphRef } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { refusalOf } from "../api";
import { CHANNEL_KIND_LABEL } from "../DeliveryPicker";
import { useChannelsQuery, useDeleteChannel } from "../queries";
import type { Channel } from "../types";
import { AddChannelDialog } from "./AddChannelDialog";

/** Where the Graph's rules and schedules deliver, and the act of adding one. */
export function ChannelsTab({ graph }: { graph: GraphRef }) {
	const channels = useChannelsQuery(graph);
	const [adding, setAdding] = useState(false);
	const items = channels.data?.items ?? [];

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-2 p-4">
				<SectionHeader
					bare
					title="Channels"
					count={channels.data?.total}
					actions={
						<Button size="sm" onClick={() => setAdding(true)}>
							<Plus />
							Add channel
						</Button>
					}
				/>
				<ItemGroup className="gap-2">
					<Item variant="outline" size="sm">
						<ItemContent>
							<ItemTitle>In app</ItemTitle>
							<ItemDescription>
								the Inbox and the bell · always on
							</ItemDescription>
						</ItemContent>
						<ItemActions>
							<Badge variant="outline" tone="success">
								on
							</Badge>
						</ItemActions>
					</Item>
					{channels.isLoading ? (
						<Spinner />
					) : channels.error ? (
						<FormError error={refusalOf(channels.error)} />
					) : (
						items.map((c) => (
							<ChannelRow key={c.id} graph={graph} channel={c} />
						))
					)}
					<Item variant="outline" size="sm">
						<ItemContent>
							<ItemTitle>Microsoft Teams</ItemTitle>
							<ItemDescription>not connected</ItemDescription>
						</ItemContent>
					</Item>
				</ItemGroup>
				<p className="text-sm text-muted-foreground">
					Rules and schedules deliver through these channels.
				</p>
			</div>
			{adding && (
				<AddChannelDialog graph={graph} onClose={() => setAdding(false)} />
			)}
		</div>
	);
}

/** One channel: what it is, whether it can deliver, and Remove. */
function ChannelRow({ graph, channel }: { graph: GraphRef; channel: Channel }) {
	const remove = useDeleteChannel(graph);
	const [confirming, setConfirming] = useState(false);

	return (
		<Item variant="outline" size="sm">
			<ItemContent>
				<ItemTitle>{channel.name}</ItemTitle>
				<ItemDescription>
					{CHANNEL_KIND_LABEL[channel.kind] ?? channel.kind} · {channel.target}
				</ItemDescription>
			</ItemContent>
			<ItemActions>
				{channel.ready ? (
					<Badge variant="outline" tone="success">
						ready
					</Badge>
				) : (
					<span className="text-sm text-destructive">
						{channel.reason || "not ready"}
					</span>
				)}
				<Button
					variant="ghost"
					size="sm"
					aria-label={`Remove ${channel.name}`}
					disabled={remove.isPending}
					onClick={() => setConfirming(true)}
				>
					Remove
				</Button>
			</ItemActions>
			{remove.error ? (
				<FormError className="basis-full" error={refusalOf(remove.error)} />
			) : null}
			<ConfirmDialog
				open={confirming}
				title={`Remove ${channel.name}?`}
				description="Nothing is delivered through it again. A channel a rule or schedule still uses cannot be removed."
				confirmLabel="Remove"
				destructive
				onOpenChange={setConfirming}
				onConfirm={() => remove.mutate(channel.id)}
			/>
		</Item>
	);
}
