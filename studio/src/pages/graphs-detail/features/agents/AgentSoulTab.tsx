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
	Button,
	EmissionCard,
	PropertyList,
	PropertyRow,
	SegmentedControl,
} from "@invana/ui";
import { MessageSquareText } from "lucide-react";
import { useState } from "react";

/** A question most agents get — the author changes it to one this agent gets. */
const SAMPLE_ASK = "What can you tell me about this graph?";

export function AgentSoulTab({
	username,
	graphSlug,
	agent,
	draft,
	onPatch,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	draft: AgentDraft;
	onPatch: (next: Partial<AgentDraft>) => void;
}) {
	const [ask, setAsk] = useState(SAMPLE_ASK);
	const preview = useSoulPreviewMutation(username, graphSlug, agent.id);

	const setDial = (key: keyof SoulTraits, value: string, fallback: string) => {
		const traits = { ...draft.soul_traits } as Record<string, string>;
		// The default is *no key*, so an untouched dial and one set back to its
		// default save the same — and read as Invana's voice on the Overview.
		if (value === fallback) delete traits[key];
		else traits[key] = value;
		onPatch({ soul_traits: traits as SoulTraits });
	};

	const chars = draft.soul.trim().length;
	const runPreview = () =>
		preview.mutate({
			ask: ask.trim() || SAMPLE_ASK,
			soul: draft.soul,
			soul_traits: draft.soul_traits,
		});

	return (
		<>
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

			<PanelSection title="Preview" hint="one ask, current voice and the draft">
				<div className="flex gap-1.5">
					<Input
						aria-label="Sample ask"
						value={ask}
						onChange={(e) => setAsk(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") runPreview();
						}}
					/>
					<Button
						size="sm"
						variant="outline"
						disabled={preview.isPending}
						onClick={runPreview}
					>
						<MessageSquareText />
						{preview.isPending ? "Asking…" : "Preview"}
					</Button>
				</div>
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
