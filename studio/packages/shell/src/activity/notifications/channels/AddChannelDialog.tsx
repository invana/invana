/**
 * *Add channel* — somewhere outside Invana that rules and schedules deliver
 * to.
 *
 * | Kind | Target | Secret |
 * |---|---|---|
 * | Email | addresses, comma separated | — |
 * | Slack | an incoming-webhook URL | — |
 * | Webhook | the URL to POST to | optional; signs each delivery |
 *
 * The target and secret are write-only: once saved, the channel reads back
 * with its target masked. A refused write shows the engine's reason inline.
 */

import { Input, Label, PasswordInput } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	ToggleGroup,
	ToggleGroupItem,
} from "@invana/ui";
import type { GraphRef } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useState } from "react";
import { refusalOf } from "../api";
import { CHANNEL_KIND_LABEL } from "../DeliveryPicker";
import { useCreateChannel } from "../queries";
import type { ChannelKind } from "../types";

const KINDS: ChannelKind[] = ["email", "slack", "webhook"];

/** The target field's label, by kind. */
const TARGET_LABEL: Record<ChannelKind, string> = {
	email: "Addresses, comma separated",
	slack: "Slack incoming-webhook URL",
	webhook: "URL to POST to",
};

const TARGET_PLACEHOLDER: Record<ChannelKind, string> = {
	email: "ops@example.org, ravi@example.org",
	slack: "https://hooks.slack.com/services/…",
	webhook: "https://example.org/invana",
};

/** Adds one channel; mounted only while it is open. */
export function AddChannelDialog({
	graph,
	onClose,
}: {
	graph: GraphRef;
	onClose: () => void;
}) {
	const create = useCreateChannel(graph);
	const [kind, setKind] = useState<ChannelKind>("email");
	const [name, setName] = useState("");
	const [target, setTarget] = useState("");
	const [secret, setSecret] = useState("");

	const save = () =>
		create.mutate(
			{
				name: name.trim(),
				kind,
				target: target.trim(),
				secret: kind === "webhook" && secret ? secret : null,
			},
			{ onSuccess: () => onClose() },
		);

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Add channel</DialogTitle>
					<DialogDescription>
						Rules and schedules deliver through it once it is added.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Label>Kind</Label>
						<ToggleGroup
							type="single"
							variant="outline"
							size="sm"
							className="justify-start"
							value={kind}
							onValueChange={(v: string) => v && setKind(v as ChannelKind)}
						>
							{KINDS.map((k) => (
								<ToggleGroupItem key={k} value={k}>
									{CHANNEL_KIND_LABEL[k]}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="channel-name">Name</Label>
						<Input
							id="channel-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="#agents-ops"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="channel-target">{TARGET_LABEL[kind]}</Label>
						<Input
							id="channel-target"
							value={target}
							onChange={(e) => setTarget(e.target.value)}
							placeholder={TARGET_PLACEHOLDER[kind]}
						/>
					</div>
					{kind === "webhook" && (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="channel-secret">Secret</Label>
							<PasswordInput
								id="channel-secret"
								value={secret}
								onChange={(e) => setSecret(e.target.value)}
								placeholder="optional"
							/>
							<span className="text-sm text-muted-foreground">
								Signs each delivery with X-Invana-Signature
							</span>
						</div>
					)}
					{create.error ? <FormError error={refusalOf(create.error)} /> : null}
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!name.trim() || !target.trim() || create.isPending}
						onClick={save}
					>
						Add channel
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
