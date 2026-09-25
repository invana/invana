/**
 * Soul — who the agent is and how it speaks (5.8): four voice dials beside the
 * Markdown, and a preview that answers one ask in the current voice and in the
 * draft (SO7 · SO8).
 *
 * The dials and the soul reach only the steps a person reads (SO2), so nothing
 * here can change what the agent may do. An empty soul is Invana's default
 * voice, never no voice (SO3) — the editor shows it as its placeholder and the
 * tab says so.
 */

import { useSoulPreviewMutation } from "@/hooks/queries/useWork";
import { formatRelativeTime } from "@/lib/time";
import {
	type AgentDraft,
	DEFAULT_VOICE,
	DIALS,
} from "@/pages/graphs-detail/features/agents/agentDraft";
import type { Agent, SoulTraits } from "@/types/work";
import { PanelSection } from "@/ui/PanelSection";
import { MarkdownEditorBlock } from "@invana/editor";
import { Input } from "@invana/forms";
import {
	EmissionCard,
	PropertyList,
	PropertyRow,
	SegmentedControl,
} from "@invana/ui";
import { useState } from "react";

/** Two columns at 760px of page, one below — a container query, not the viewport. */
export const TWO_COLUMNS =
	"grid @min-[760px]:grid-cols-[340px_minmax(0,1fr)] @min-[760px]:divide-x divide-border";

/** A question most agents get — the author changes it to one this agent gets. */
const SAMPLE_ASK = "What can you tell me about this graph?";

/**
 * The preview's state, held by the page rather than the tab: **Preview** sits
 * in the page header beside Discard · Save, as drawn, and the sample ask it
 * answers is typed on the tab.
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
	const { ask, setAsk, preview, run: runPreview } = soulPreview;

	const setDial = (key: keyof SoulTraits, value: string, fallback: string) => {
		const traits = { ...draft.soul_traits } as Record<string, string>;
		// The default is *no key*, so an untouched dial and one set back to its
		// default save the same — and read as Invana's voice on the Overview.
		if (value === fallback) delete traits[key];
		else traits[key] = value;
		onPatch({ soul_traits: traits as SoulTraits });
	};

	const chars = draft.soul.trim().length;

	return (
		<>
			{/* The dials beside the Markdown, as drawn, when the page is wide
			    enough for both; stacked when `rightSection` takes the room. */}
			<div className={TWO_COLUMNS}>
				<PanelSection title="Voice" hint="humour is always off in a refusal">
					<PropertyList labelWidth={84}>
						{DIALS.map((dial) => (
							<PropertyRow key={dial.key} label={dial.label}>
								<SegmentedControl
									size="xs"
									aria-label={dial.label}
									value={draft.soul_traits[dial.key] ?? dial.default}
									onValueChange={(v) => setDial(dial.key, v, dial.default)}
									options={dial.values.map((v) => ({
										value: v,
										label: v[0].toUpperCase() + v.slice(1),
									}))}
								/>
							</PropertyRow>
						))}
					</PropertyList>
				</PanelSection>

				<PanelSection
					title="Soul"
					hint={
						chars
							? `~${chars.toLocaleString()} characters in every ask`
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

			<PanelSection title="Preview" hint="one ask, current voice and the draft">
				<Input
					aria-label="Sample ask"
					value={ask}
					onChange={(e) => setAsk(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") runPreview();
					}}
				/>
				<p className="mt-1.5 text-sm text-muted-foreground">
					Neither reply reads the graph — a voice is being judged, not an
					answer. Nothing is recorded or spent against this agent.
				</p>
				{preview.error ? (
					<p role="alert" className="mt-2 text-sm text-destructive">
						{preview.error instanceof Error
							? preview.error.message
							: "The preview could not run."}
					</p>
				) : null}
				{preview.data ? (
					<div className="mt-2 space-y-2">
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
					</div>
				) : null}
			</PanelSection>
		</>
	);
}
