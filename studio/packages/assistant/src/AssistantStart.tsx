import { EmptyState } from "@invana/ui";
import type { ReactNode } from "react";
import { RecentSessions } from "./RecentSessions";
import { SessionComposer, type SessionComposerProps } from "./SessionComposer";
import type { useSessions } from "./useSessions";
import { WorldPicker } from "./WorldPicker";

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
	/** Dock the assistant on the right, so a reopened session has somewhere to go. */
	onOpenAssistant: () => void;
	/** Make a recent session the open one. */
	onOpenSession: (sessionId: string) => void;
}

/**
 * The assistant before a conversation exists: one question box in the middle
 * of an empty board, the recent conversations under it.
 *
 * Starting here is asking, not configuring. The first send is an ordinary ask
 * — the host docks the assistant on the right as it sends, so the
 * conversation moves there and the board keeps what it draws. The composer
 * names the agent that will answer and the world it will look in, the same
 * two controls the docked chat carries. A recent row reopens its session in
 * the docked chat, where the rest of the history lives.
 */
export function AssistantStart({
	username,
	graphSlug,
	graphName,
	subtitle,
	world,
	onManageWorlds,
	onOpenAssistant,
	onOpenSession,
	...composer
}: AssistantStartProps) {
	return (
		<div className="flex w-full max-w-2xl flex-col gap-4">
			<EmptyState
				title={`What do you want to know about ${graphName}?`}
				description={subtitle}
			/>
			<SessionComposer
				{...composer}
				sessionKey={null}
				takesAsk={false}
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
			<RecentSessions
				username={username}
				graphSlug={graphSlug}
				onOpenAssistant={onOpenAssistant}
				onOpenSession={onOpenSession}
			/>
		</div>
	);
}
