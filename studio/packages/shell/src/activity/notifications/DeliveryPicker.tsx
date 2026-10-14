import { Label } from "@invana/forms";
import { ToggleGroup, ToggleGroupItem } from "@invana/ui";
import type { GraphRef } from "@invana-studio/core";
import { useChannelsQuery } from "./queries";
import type { ChannelKind } from "./types";

export const CHANNEL_KIND_LABEL: Record<ChannelKind, string> = {
	email: "Email",
	slack: "Slack",
	webhook: "Webhook",
};

const IN_APP = "in_app";

export interface DeliveryPickerProps {
	graph: GraphRef;
	/** The field's label: *Deliver to* on a schedule, *On* on a rule. */
	label: string;
	inApp: boolean;
	channelIds: string[];
	onChange: (next: { inApp: boolean; channelIds: string[] }) => void;
}

/**
 * Where something is delivered: *In app* and each of the Graph's channels, as
 * one row of toggles. A schedule's dialog and a rule's both use it, so the
 * two read the same channels the same way. With no channels, it says where
 * one is added.
 */
export function DeliveryPicker({
	graph,
	label,
	inApp,
	channelIds,
	onChange,
}: DeliveryPickerProps) {
	const channels = useChannelsQuery(graph).data?.items ?? [];
	const value = [...(inApp ? [IN_APP] : []), ...channelIds];
	return (
		<div className="flex flex-col gap-2">
			<Label>{label}</Label>
			<ToggleGroup
				type="multiple"
				variant="outline"
				size="sm"
				className="flex-wrap justify-start"
				value={value}
				onValueChange={(next: string[]) =>
					onChange({
						inApp: next.includes(IN_APP),
						channelIds: next.filter((v) => v !== IN_APP),
					})
				}
			>
				<ToggleGroupItem value={IN_APP}>In app</ToggleGroupItem>
				{channels.map((c) => (
					<ToggleGroupItem key={c.id} value={c.id}>
						{CHANNEL_KIND_LABEL[c.kind] ?? c.kind} · {c.name}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			{channels.length === 0 && (
				<p className="text-sm text-muted-foreground">
					No channels yet — email, Slack and webhooks are added in Activity ›
					Channels.
				</p>
			)}
		</div>
	);
}
