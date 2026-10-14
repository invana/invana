import type { ReactNode } from "react";
import {
	AssistantViewPanel,
	type AssistantViewPanelProps,
} from "./AssistantViewPanel";
import type { useSessions } from "./useSessions";
import { WorldPicker } from "./WorldPicker";

interface AssistantHostProps
	extends Omit<AssistantViewPanelProps, "worldControl"> {
	/** The Graph has no connection — nothing can be asked yet. */
	connectionMissing: boolean;
	/** The answering gate is shut — the panel would refuse every question. */
	cannotAnswer: boolean;
	/** The set-up lock that names the missing step, drawn instead of the panel. */
	renderLock: (gate: "connected" | "answering", surface: string) => ReactNode;
	/** The open thread's world, and the setters its picker drives. */
	world: ReturnType<typeof useSessions>["world"];
	/** `Manage` on the world picker — opens Govern beside the thread. */
	onManageWorlds: () => void;
	/** The open Graph, for the world picker. */
	username: string | undefined;
	graphSlug: string | undefined;
}

/**
 * The assistant, as the right side's `assistant` occupant.
 *
 * Its sessions live on the right and nowhere else: the left rail is for the
 * page's own panels, and asking never costs you the one you had open. Until
 * the Graph is connected and can answer, the region holds the setup lock that
 * names the missing step instead of the panel.
 */
export function AssistantHost({
	connectionMissing,
	cannotAnswer,
	renderLock,
	world,
	onManageWorlds,
	username,
	graphSlug,
	...panel
}: AssistantHostProps) {
	if (connectionMissing) return renderLock("connected", "The Assistant");
	if (cannotAnswer) return renderLock("answering", "Ask");
	return (
		<AssistantViewPanel
			{...panel}
			// The world is the thread's, set where it asks.
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
	);
}
