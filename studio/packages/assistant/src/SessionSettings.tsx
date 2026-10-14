import { formatCompact } from "@invana-studio/core";

/**
 * A token cap per run for the thread — the session's settings, opened from
 * the thread header (the-assistant.md).
 *
 * *As someone asking in a thread, I want to cap the tokens one ask may use, so
 * that a question that runs away cannot use more than I meant it to.*
 *
 * **Held at the agent's own run budget, `max_tokens_run`.** The engine clamps
 * on write, so the value that comes back is the one in force; when it came
 * back lower than what was typed, the popover says so rather than silently
 * changing it. Empty is *the agent's budget*.
 */

import { Input } from "@invana/forms";
import {
	Button,
	Eyebrow,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@invana/ui";
import type { Session } from "@invana-studio/core";
import { useEffect, useState } from "react";

export interface SessionSettingsProps {
	session: Session;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (tokens: number | null) => Promise<unknown>;
}

export function SessionSettings({
	session,
	open,
	onOpenChange,
	onSave,
}: SessionSettingsProps) {
	const cap = session.agentMaxTokensRun;
	const [draft, setDraft] = useState("");
	const [asked, setAsked] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		setDraft(session.maxTokensRun != null ? String(session.maxTokensRun) : "");
		setAsked(null);
	}, [open, session.maxTokensRun]);

	const parsed = draft.trim() === "" ? null : Number(draft);
	const invalid =
		parsed !== null &&
		(!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0);
	const clamped =
		asked !== null &&
		cap != null &&
		asked > cap &&
		session.maxTokensRun === cap;

	const save = async () => {
		if (invalid) return;
		setSaving(true);
		try {
			await onSave(parsed);
			setAsked(parsed);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			{/* The panel header only renders icon buttons, so its settings button
			    opens this controlled popover, anchored under the header's corner —
			    the same seam the filter menu uses. */}
			<PopoverTrigger asChild>
				<span
					aria-hidden
					className="pointer-events-none absolute right-2 top-0 h-0 w-0"
				/>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-72 space-y-3">
				<Eyebrow>Session settings</Eyebrow>
				<div className="space-y-1.5">
					<label htmlFor="session-tokens-per-run">Tokens per run</label>
					<Input
						id="session-tokens-per-run"
						type="number"
						inputMode="numeric"
						min={1}
						step={1000}
						placeholder={
							cap != null
								? `${formatCompact(cap)} — the agent's budget`
								: "tokens"
						}
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") void save();
						}}
						aria-invalid={invalid || undefined}
					/>
				</div>
				<p className="text-muted-foreground">
					{cap != null
						? `${session.agentName ?? "The agent"} allows up to ${formatCompact(cap)} tokens a run.`
						: `${session.agentName ?? "The agent"} sets no token budget per run.`}
					{clamped
						? ` Held at ${formatCompact(cap as number)} — the agent's budget.`
						: ""}
				</p>
				<div className="flex justify-end gap-2">
					<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
						Close
					</Button>
					<Button
						size="sm"
						onClick={() => void save()}
						disabled={invalid || saving}
					>
						{saving ? "Saving…" : "Save"}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
