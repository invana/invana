/**
 * What the Policies section and a policy's page share: the kind badge, the
 * `says` badge of a layer's verdict, a statement's conditions as one line, the
 * page's `?tab=` and `?dialog=` read from the URL while the page is in front,
 * and the read state a tab shows while its read is in flight or refused.
 *
 * Every count and line printed here is the engine's; these only format.
 */

import { Badge, Button, EmptyState, Spinner } from "@invana/ui";
import {
	formatCompact,
	formatGrouped,
	formatShortDate,
	formatShortDateTime,
} from "@invana-studio/core";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
	PolicyKindName,
	Says,
	StatementIn,
	StatementRead,
} from "../types";

const KIND_TONE: Record<
	PolicyKindName,
	"muted" | "success" | "warning" | "destructive"
> = {
	managed: "muted",
	custom: "success",
	inline: "warning",
	boundary: "destructive",
};

/** A policy's kind as the list and the page draw it — `managed` plain, the rest tinted. */
export function KindBadge({ kind }: { kind: PolicyKindName }) {
	return (
		<Badge
			variant={kind === "managed" ? "outline" : "soft"}
			tone={KIND_TONE[kind]}
		>
			{kind}
		</Badge>
	);
}

/** `draft` beside the kind, while nothing is saved. */
export function DraftBadge() {
	return (
		<Badge variant="outline" tone="muted">
			draft
		</Badge>
	);
}

const SAYS_TONE: Record<Says, "success" | "destructive" | "muted"> = {
	allows: "success",
	refuses: "destructive",
	"n/a": "muted",
};

/** One layer's verdict — `allows` · `refuses` · `n/a`. */
export function SaysBadge({ says }: { says: Says }) {
	return (
		<Badge variant="soft" tone={SAYS_TONE[says]}>
			{says}
		</Badge>
	);
}

/** A statement's effect — always `allow`; nothing is denied by a statement. */
export function EffectBadge() {
	return (
		<Badge variant="soft" tone="success">
			allow
		</Badge>
	);
}

interface Conditions {
	fields?: { only?: string[]; except?: string[] };
	depth?: { max?: number };
	until?: string;
}

/** `only fields price, checked_at` · `lead agents only — depth 0` · `until Oct 2, 9:29 PM`. */
export function conditionsLine(raw: Record<string, unknown>): string {
	const c = raw as Conditions;
	const parts: string[] = [];
	if (c.fields?.only?.length)
		parts.push(`only fields ${c.fields.only.join(", ")}`);
	if (c.fields?.except?.length)
		parts.push(`except fields ${c.fields.except.join(", ")}`);
	if (typeof c.depth?.max === "number")
		parts.push(
			c.depth.max === 0
				? "lead agents only — depth 0"
				: `at most ${c.depth.max} spawn levels`,
		);
	if (typeof c.until === "string")
		parts.push(`until ${formatShortDateTime(new Date(c.until))}`);
	return parts.join(" · ") || "—";
}

/** A statement as it is sent back — what an impact or an edit takes. */
export const statementIn = ({
	actions,
	resources,
	conditions,
}: StatementRead): StatementIn => ({
	effect: "allow",
	actions,
	resources,
	conditions,
});

/** `sam · Oct 2`, or `—` when nobody has changed it. */
export function byLine(by: string | null, at: string | null): string {
	if (!by && !at) return "—";
	const when = at ? formatShortDate(new Date(at)) : null;
	return [by, when].filter(Boolean).join(" · ");
}

/** A ceiling as the Limits table prints it: tokens compact, counts grouped, pools listed. */
export function ceilingLine(key: string, ceiling: number | string[] | null) {
	if (ceiling === null) return "—";
	if (Array.isArray(ceiling)) return ceiling.join(" · ") || "—";
	return key.startsWith("tokens")
		? formatCompact(ceiling)
		: formatGrouped(ceiling);
}

/**
 * One URL key a page owns while it is in front (`?tab=`, `?dialog=`); behind
 * another tab it keeps its own value, so two pages never fight over the URL.
 */
export function usePageParam<T extends string>(
	key: string,
	inFront: boolean,
	allowed: readonly T[],
	fallback: T | null,
): [T | null, (next: T | null) => void] {
	const [params, setParams] = useSearchParams();
	const [local, setLocal] = useState<T | null>(fallback);
	const fromUrl = params.get(key);
	const valid = (v: string | null): v is T =>
		v !== null && (allowed as readonly string[]).includes(v);
	const value = inFront ? (valid(fromUrl) ? fromUrl : fallback) : local;
	const set = (next: T | null) => {
		setLocal(next);
		if (!inFront) return;
		setParams(
			(prev) => {
				const out = new URLSearchParams(prev);
				if (next === null || next === fallback) out.delete(key);
				else out.set(key, next);
				return out;
			},
			{ replace: true },
		);
	};
	return [value, set];
}

/** A read in flight, or refused, in place of a tab's body. Draws nothing once read. */
export function ReadState({
	loading,
	error,
	what,
	onRetry,
}: {
	loading: boolean;
	error: unknown;
	/** What is being read — `this policy's holders`. */
	what: string;
	onRetry?: () => void;
}) {
	if (loading)
		return (
			<div className="flex items-center justify-center p-6">
				<Spinner />
			</div>
		);
	if (!error) return null;
	return (
		<EmptyState
			icon={<CircleAlert className="size-6" />}
			title={`Could not read ${what}`}
			description={error instanceof Error ? error.message : undefined}
			actions={
				onRetry ? (
					<Button variant="outline" size="sm" onClick={onRetry}>
						Try again
					</Button>
				) : undefined
			}
		/>
	);
}
