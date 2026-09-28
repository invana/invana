import {
	AssistantViewPanel,
	type AssistantViewPanelProps,
} from "@/pages/graphs-detail/features/assistant";
import { WorldPicker } from "@/pages/graphs-detail/features/assistant";
import type { useSessions } from "@/pages/graphs-detail/features/assistant";
import { SetupLock } from "@/pages/graphs-detail/features/setup/SetupLock";
import type { ComponentProps } from "react";

interface AssistantHostProps
	extends Omit<AssistantViewPanelProps, "worldControl"> {
	/** The Graph has no connection — nothing can be asked yet. */
	connectionMissing: boolean;
	/** The answering gate is shut — the panel would refuse every question. */
	cannotAnswer: boolean;
	graph: ComponentProps<typeof SetupLock>["graph"];
	/** The open thread's world, and the setters its picker drives. */
	world: ReturnType<typeof useSessions>["world"];
	/** `Manage` on the world picker — opens Govern beside the thread. */
	onManageWorlds: () => void;
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
	graph,
	world,
	onManageWorlds,
	...panel
}: AssistantHostProps) {
	if (connectionMissing)
		return <SetupLock graph={graph} gate="connected" surface="The Assistant" />;
	if (cannotAnswer)
		return <SetupLock graph={graph} gate="answering" surface="Ask" />;
	return (
		<AssistantViewPanel
			{...panel}
			// The world is the thread's, set where it asks.
			worldControl={
				<WorldPicker
					username={panel.username}
					graphSlug={panel.graphSlug}
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
