/**
 * An agent › **Soul** (board `agents.agent.soul`): who the agent is and how it
 * speaks — the voice dials, the soul's Markdown, and a sample ask answered in
 * the current voice and in the draft before saving.
 *
 * The dials and the soul reach only the steps a person reads, so nothing here
 * changes what the agent may do. An empty soul is Invana's default voice,
 * never no voice — the editor shows it as its placeholder. The dials and the
 * soul ride the page's one buffer; Save in the head writes them, and History
 * keeps the change.
 */

import { MarkdownEditorBlock } from "@invana/editor";
import { Input, Label } from "@invana/forms";
import {
	EmissionCard,
	PropertyList,
	PropertyRow,
	SegmentedControl,
} from "@invana/ui";
import { formatRelativeTime } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { FormError, PanelSection } from "@invana-studio/ui";
import { Play } from "lucide-react";
import { useState } from "react";
import { type AgentDraft, DEFAULT_VOICE, DIALS } from "./agentDraft";
import { useSoulPreviewMutation } from "./queries";
import type { Agent, SoulTraits } from "./types";

/** A question most agents get — the author changes it to one this agent gets. */
const SAMPLE_ASK = "What can you tell me about this graph?";

/**
 * The preview's state, held by the page so the sample ask and its replies
 * survive a switch to another tab and back.
 */
export function useSoulPreview(
	username: string,
	graphSlug: string,
	agentId: string,
	draft: AgentDraft,
) {
	const [ask, setAsk] = useState(SAMPLE_ASK);
	const preview = useSoulPreviewMutation(username, graphSlug, agentId);
	const run = () =>
		preview.mutate({
			ask: ask.trim() || SAMPLE_ASK,
			soul: draft.soul,
			soul_traits: draft.soul_traits,
		});
	return { ask, setAsk, preview, run };
}

export type SoulPreviewState = ReturnType<typeof useSoulPreview>;

export function AgentSoulTab({
	agent,
	draft,
	onPatch,
	soulPreview,
}: {
	agent: Agent;
	draft: AgentDraft;
	onPatch: (next: Partial<AgentDraft>) => void;
	soulPreview: SoulPreviewState;
}) {
	const { ask, setAsk, preview, run } = soulPreview;

	const setDial = (key: keyof SoulTraits, value: string, fallback: string) => {
		const traits = { ...draft.soul_traits } as Record<string, string>;
		// The default is *no key*, so an untouched dial and one set back to its
		// default save the same.
		if (value === fallback) delete traits[key];
		else traits[key] = value;
		onPatch({ soul_traits: traits as SoulTraits });
	};

	return (
		<div className="grid items-start gap-2.5 p-3.5 @[760px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
			<div className="flex min-w-0 flex-col gap-2.5">
				<PanelSection
					card
					title="Voice"
					hint="humour is always off in a refusal"
				>
					<PropertyList labelWidth={96}>
						{DIALS.map((dial) => (
							<PropertyRow key={dial.key} label={dial.label}>
								<SegmentedControl
									size="xs"
									aria-label={dial.label}
									value={draft.soul_traits[dial.key] ?? dial.default}
									onValueChange={(v) => setDial(dial.key, v, dial.default)}
									options={dial.values.map((v) => ({ value: v, label: v }))}
								/>
							</PropertyRow>
						))}
					</PropertyList>
				</PanelSection>

				<PanelSection
					card
					title="Soul"
					hint={
						draft.soul.trim()
							? "soul.md · Markdown"
							: "Speaking in Invana's default voice"
					}
				>
					<MarkdownEditorBlock
						aria-label="Soul"
						value={draft.soul}
						onChange={(soul) => onPatch({ soul })}
						placeholder={DEFAULT_VOICE}
						version={`v${agent.version}`}
						className="min-h-40"
					/>
					<p className="mt-1.5 text-sm text-muted-foreground">
						version {agent.version} · edited{" "}
						{formatRelativeTime(new Date(agent.updated_at))}
					</p>
				</PanelSection>
			</div>

			<div className="flex min-w-0 flex-col gap-1.5">
				<PanelSection card title="Preview">
					<div className="flex flex-col gap-2">
						<Label htmlFor="soul-sample-ask">Sample ask</Label>
						<Input
							id="soul-sample-ask"
							value={ask}
							onChange={(e) => setAsk(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") run();
							}}
						/>
						<FormError
							error={preview.error instanceof Error ? preview.error : null}
						/>
						{preview.data ? (
							<>
								<EmissionCard
									kind="prose"
									note="current voice"
									template={preview.data.model ?? undefined}
								>
									<p className="whitespace-pre-wrap px-3 py-2">
										{preview.data.current}
									</p>
								</EmissionCard>
								<EmissionCard kind="prose" note="draft">
									<p className="whitespace-pre-wrap px-3 py-2">
										{preview.data.draft}
									</p>
								</EmissionCard>
							</>
						) : null}
						<ActButton
							area="build"
							size="sm"
							variant="outline"
							disabled={preview.isPending}
							onClick={run}
						>
							<Play /> {preview.isPending ? "Asking…" : "Preview"}
						</ActButton>
					</div>
				</PanelSection>
				<p className="text-sm text-muted-foreground">
					Neither reply reads the graph, and nothing is spent against this
					agent. Saving a soul is a change in History, with the runs after it.
				</p>
			</div>
		</div>
	);
}
