/**
 * One request, as the Requests page lists it.
 *
 * The title is the ask as asked; the line under it says who asked, from where,
 * why it is here and when:
 *
 * | Kind | Why it is here |
 * |---|---|
 * | `guardrail` | `blocked by <guardrail>` — the name frozen at filing, a link to the guardrail with this request's bar |
 * | `unanswered` | `the Graph could not answer "<ask>"`, or how many times it was asked |
 * | `change` | nothing more — the title is the change asked for |
 *
 * An open row carries its acts at the right — *Decline* and *Allow in a world*
 * for a guardrail request, *Decline* and *Model it* for any other — and only
 * for a reader who may resolve. A done row reads what resolving did, from the
 * engine's `resolution_note`, beside a `done` chip.
 */

import { Badge, Button } from "@invana/ui";
import { formatRelativeTime } from "@invana-studio/core";
import { RecordRow } from "@invana-studio/ui";
import { ListPlus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ModelRequest, RequestSource } from "./types";

/** Where an ask came from, in the product's words. An agent is named as the asker. */
const FROM: Record<RequestSource, string | null> = {
	explorer: "from Explorer",
	agent: null,
	schedule: "from a schedule",
	api: "from the API",
};

/** The guardrail page, opened with this request's bar. */
const guardrailRequestPath = (
	username: string,
	graphSlug: string,
	guardrailId: string,
	requestId: string,
) =>
	`/u/${username}/${graphSlug}/modeller/guardrails/${guardrailId}?request=${requestId}`;

function when(iso: string | null): string | null {
	return iso ? formatRelativeTime(new Date(iso)) : null;
}

/** Joins the parts of a row's line with ` · `, keeping node parts as nodes. */
function line(parts: (ReactNode | null)[]): ReactNode {
	const kept = parts.filter((p) => p !== null && p !== "");
	return (
		<span className="truncate">
			{kept.map((part, i) => (
				// The parts are positional and never reorder.
				// biome-ignore lint/suspicious/noArrayIndexKey: positional parts
				<span key={i}>
					{i ? " · " : null}
					{part}
				</span>
			))}
		</span>
	);
}

export interface RequestRowProps {
	request: ModelRequest;
	username: string;
	graphSlug: string;
	/** Whether the reader may resolve — without it the row carries no acts. */
	mayResolve: boolean;
	/** A resolve is in flight for this row. */
	busy: boolean;
	onDecline: (request: ModelRequest) => void;
	onAllow: (request: ModelRequest) => void;
	onModel: (request: ModelRequest) => void;
}

export function RequestRow({
	request,
	username,
	graphSlug,
	mayResolve,
	busy,
	onDecline,
	onAllow,
	onModel,
}: RequestRowProps) {
	const open = request.status === "open";
	// An open row names who asked; a done row, who resolved it.
	const who =
		(open ? null : request.resolved_by) ??
		request.asked_by ??
		request.agent ??
		"someone";

	let why: ReactNode = null;
	if (!open) {
		why = request.resolution_note ?? request.status;
	} else if (request.kind === "guardrail") {
		const name = request.blocked_by ?? "a guardrail";
		why = (
			<>
				blocked by{" "}
				{request.guardrail_id ? (
					<Link
						className="font-mono text-foreground hover:underline"
						to={guardrailRequestPath(
							username,
							graphSlug,
							request.guardrail_id,
							request.id,
						)}
					>
						{name}
					</Link>
				) : (
					<span className="font-mono">{name}</span>
				)}
			</>
		);
	} else if (request.kind === "unanswered") {
		why =
			request.asks > 1
				? `${request.asks} asks it could not answer`
				: `the Graph could not answer "${request.title}"`;
	}

	const subtitle = line([
		who,
		open ? FROM[request.source] : null,
		why,
		when(open ? request.last_asked_at : request.resolved_at),
	]);

	const acts =
		open && mayResolve ? (
			<>
				<Button
					variant="ghost"
					size="sm"
					disabled={busy}
					onClick={() => onDecline(request)}
				>
					Decline
				</Button>
				{request.kind === "guardrail" ? (
					<Button
						variant="outline"
						size="sm"
						disabled={busy}
						onClick={() => onAllow(request)}
					>
						Allow in a world
					</Button>
				) : (
					<Button
						variant="outline"
						size="sm"
						disabled={busy}
						onClick={() => onModel(request)}
					>
						<ListPlus />
						Model it
					</Button>
				)}
			</>
		) : null;

	return (
		<RecordRow
			tone={open ? "warning" : "muted"}
			title={request.title}
			subtitle={subtitle}
			actions={
				open ? (
					acts
				) : (
					<Badge variant="outline" size="sm">
						done
					</Badge>
				)
			}
			pinActions
		/>
	);
}
