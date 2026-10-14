import { Button, Eyebrow } from "@invana/ui";
import { formatRelativeTime } from "@invana-studio/core";
import { BoardGround } from "@invana-studio/ui";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sessionsApi } from "./api";
import { SessionComposer, type SessionComposerProps } from "./SessionComposer";
import { sessionsListKey, type useSessions } from "./useSessions";
import { WorldPicker } from "./WorldPicker";

/** How many recent questions and views the start offers. */
const SHOWN = 3;

/** A one-click ask runs under the composer's default budget. */
const ASK_TIMEOUT_S = 120;

/** A kept canvas, as the start's *Your views* reads it. */
interface StartView {
	id: string;
	sessionId: string;
	title: string;
	pinned: boolean;
	updatedAt: Date;
}

interface AssistantStartProps
	extends Pick<
		SessionComposerProps,
		| "availableLanguages"
		| "defaultLanguage"
		| "llmProviders"
		| "onRun"
		| "onStop"
		| "isRunning"
		| "agentName"
		| "agentStatus"
	> {
	username: string;
	graphSlug: string;
	/** The Graph's name, asked about in the heading. */
	graphName: string;
	/** One line under the heading — what the Graph is and whether it is live. */
	subtitle?: ReactNode;
	/** The world the first ask runs in, picked before the thread exists. */
	world: ReturnType<typeof useSessions>["world"];
	/** `Manage` on the world picker — opens Govern. */
	onManageWorlds: () => void;
	/** The person's canvases, most recent first — the start's *Your views*. */
	views: readonly StartView[];
	/** Reopen a view: its session's thread docks right, its canvas opens. */
	onOpenSession: (sessionId: string) => void;
}

/**
 * The Explorer before a conversation exists — one question box on an empty
 * board, and nothing else:
 *
 *   What do you want to know about airways?
 *   Routes, carriers and what is said about them · 4 models · live on Neo4j
 *   [ Ask a question, or say what to draw…                          ➤ ]
 *   [Which routes out of LHR are growing?] [Busiest airports in Europe]
 *   Your views
 *   [LHR one hop] [Routes over 8,000 km] [Weekly LHR brief]
 *
 * Starting here is asking, not configuring. The first send is an ordinary
 * ask — the host docks the chat on the right as it sends. The chips under the
 * box are the person's own recent questions, asked again in one click; the
 * cards are their kept canvases. Neither is invented: a Graph never asked
 * anything shows the box alone.
 */
export function AssistantStart({
	username,
	graphSlug,
	graphName,
	subtitle,
	world,
	onManageWorlds,
	views,
	onOpenSession,
	...composer
}: AssistantStartProps) {
	const { data } = useQuery({
		queryKey: sessionsListKey(username, graphSlug),
		queryFn: () =>
			sessionsApi.list(username, graphSlug, {
				sort: "updated",
				includeArchived: false,
				surface: "explorer",
			}),
		enabled: !!username && !!graphSlug,
	});
	// The distinct questions most recently asked — a session's title is its
	// first question until someone renames it.
	const recent = [
		...new Set(
			(data?.items ?? [])
				.map((s) => s.title?.trim())
				.filter((t): t is string => !!t && t !== "New session"),
		),
	].slice(0, SHOWN);
	const shownViews = [...views]
		.sort((a, b) => Number(b.pinned) - Number(a.pinned))
		.slice(0, SHOWN);

	return (
		<BoardGround data-testid="explorer-start" className="gap-4 p-6">
			<h1 className="text-2xl font-semibold">
				What do you want to know about {graphName}?
			</h1>
			{subtitle && (
				<p className="-mt-2 text-xs text-muted-foreground">{subtitle}</p>
			)}
			<div className="w-full max-w-2xl rounded-control shadow-lg">
				<SessionComposer
					{...composer}
					sessionKey={null}
					takesAsk={false}
					placeholder="Ask a question, or say what to draw…"
					worldControl={
						<WorldPicker
							username={username}
							graphSlug={graphSlug}
							lensId={world.lensId}
							missing={world.missing}
							nextAskOnly={world.nextAskOnly}
							onPick={world.pick}
							onNextAskOnly={world.setNextAskOnly}
							onManage={onManageWorlds}
						/>
					}
				/>
			</div>
			{recent.length > 0 && (
				<div className="flex flex-wrap justify-center gap-2">
					{recent.map((q) => (
						<Button
							key={q}
							variant="outline"
							size="sm"
							className="max-w-xs bg-card"
							title={q}
							onClick={() =>
								composer.onRun({
									mode: "nl",
									query: q,
									llmProviderId: composer.llmProviders[0]?.id ?? "",
									timeoutS: ASK_TIMEOUT_S,
								})
							}
						>
							<span className="truncate">{q}</span>
						</Button>
					))}
				</div>
			)}
			{shownViews.length > 0 && (
				<section className="mt-4 flex w-full max-w-2xl flex-col gap-2">
					<Eyebrow>Your views</Eyebrow>
					<div className="grid grid-cols-3 gap-2.5">
						{shownViews.map((v) => (
							<button
								key={v.id}
								type="button"
								className="flex min-w-0 flex-col gap-1 rounded-control border border-border bg-card px-3.5 py-3 text-left hover:bg-accent"
								onClick={() => onOpenSession(v.sessionId)}
							>
								<span className="truncate font-semibold">{v.title}</span>
								<span className="text-xs text-muted-foreground">
									{v.pinned ? "pinned" : "saved"}{" "}
									{formatRelativeTime(v.updatedAt)}
								</span>
							</button>
						))}
					</div>
				</section>
			)}
		</BoardGround>
	);
}
