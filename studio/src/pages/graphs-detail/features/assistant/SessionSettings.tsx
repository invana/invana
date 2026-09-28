import { usdWhole } from "@/lib/format";

/**
 * C10 · a spend per run for the thread — the session's settings, opened from
 * the thread header (the-assistant.md AD18 · AD21).
 *
 * *As someone asking in a thread, I want to cap what one ask may spend, so that
 * a question that runs away cannot cost more than I meant it to.*
 *
 * **Capped by the agent's own `max_cost_usd_run`.** The engine clamps on write,
 * so the value that comes back is the one in force; when it came back lower
 * than what was typed, the popover says so rather than silently changing it.
 * Empty is *the agent's cap*.
 */

import { Input } from "@invana/forms";
import {
	Button,
	Eyebrow,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@invana/ui";
import { useEffect, useState } from "react";
import type { Session } from "@/pages/graphs-detail/features/assistant/types";

export interface SessionSettingsProps {
	session: Session;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (usd: number | null) => Promise<unknown>;
}

export function SessionSettings({
	session,
	open,
	onOpenChange,
	onSave,
}: SessionSettingsProps) {
	const cap = session.agentMaxCostUsdRun;
	const [draft, setDraft] = useState("");
	const [asked, setAsked] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		setDraft(
			session.maxCostUsdRun != null ? String(session.maxCostUsdRun) : "",
		);
		setAsked(null);
	}, [open, session.maxCostUsdRun]);

	const parsed = draft.trim() === "" ? null : Number(draft);
	const invalid = parsed !== null && (!Number.isFinite(parsed) || parsed <= 0);
	const clamped =
		asked !== null &&
		cap != null &&
		asked > cap &&
		session.maxCostUsdRun === cap;

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
					<label htmlFor="session-spend-per-run">Spend per run</label>
					<Input
						id="session-spend-per-run"
						type="number"
						inputMode="decimal"
						min={0}
						step={0.1}
						placeholder={
							cap != null ? `${usdWhole(cap)} — the agent's cap` : "USD"
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
						? `${session.agentName ?? "The agent"} caps a run at ${usdWhole(cap)}.`
						: `${session.agentName ?? "The agent"} sets no cap per run.`}
					{clamped
						? ` Held at ${usdWhole(cap as number)} — the agent's cap.`
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
