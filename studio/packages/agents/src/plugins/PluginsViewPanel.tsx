/**
 * Plugins — everything agents can run, in one registry (agents.md).
 *
 * Two sections, stacked with no panel header above them: `Plugins` over
 * `Catalogue`. The registry of plugins — each with its manifests, versions and
 * who may call it — needs the engine's plugin module, so its section draws the
 * kit's `EmptyState` naming what opens it. The catalogue of task types exists
 * today; it moved here from Library, because the task types are what the
 * plugins provide. `?section=` names the section holding the height and
 * `&entry=` the task type drilled into.
 */

import {
	EmptyState,
	EmptyStateLock,
	PanelStack,
	type PanelStackHandle,
	type PanelStackSection,
} from "@invana/ui";
import { useStackSections } from "@invana-studio/shell";
import {
	PanelStatusBar,
	SectionTitle,
	StatusCrumb,
	useStackSectionUi,
} from "@invana-studio/ui";
import { Lock, Puzzle } from "lucide-react";
import { useEffect, useRef } from "react";
import { catalogueSection } from "../plans/CatalogueSection";

type PluginsSectionKey = "plugins" | "catalogue";

const SECTION_KEYS: readonly PluginsSectionKey[] = ["plugins", "catalogue"];
const DETAIL_PARAM: Record<PluginsSectionKey, string> = {
	plugins: "plugin",
	catalogue: "entry",
};

interface Props {
	username: string;
	graphSlug: string;
}

export function PluginsViewPanel({ username, graphSlug }: Props) {
	const stack = useStackSections<PluginsSectionKey>({
		sectionKeys: SECTION_KEYS,
		detailParam: DETAIL_PARAM,
	});
	const ui = useStackSectionUi();
	const entryKey = stack.detail.catalogue;

	// A drill-in expands the section holding it, as Library does, so a task
	// type opened from a link never renders into a collapsed section.
	const stackRef = useRef<PanelStackHandle>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `entryKey` is the trigger.
	useEffect(() => {
		stackRef.current?.expand(stack.sectionKey);
	}, [stack.sectionKey, entryKey]);

	const size = (d: PluginsSectionKey) =>
		stack.sectionKey === d ? "60%" : "40%";

	const sections: PanelStackSection[] = [
		{
			id: "plugins",
			title: <SectionTitle>Plugins</SectionTitle>,
			defaultSize: size("plugins"),
			content: (
				<EmptyState
					className="h-full"
					icon={<Puzzle />}
					title="No plugins yet"
					description="Core, tool, simulator and MCP plugins, each with the task types, skills and flows it brings — enabled deliberately, by an Admin."
					locks={[
						<EmptyStateLock key="engine" icon={<Lock />}>
							Opens with engine support
						</EmptyStateLock>,
					]}
				/>
			),
		},
		catalogueSection({
			username,
			graphSlug,
			ui,
			entryKey,
			onOpenEntry: (key) => stack.open("catalogue", key),
			defaultSize: size("catalogue"),
		}),
	];

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="min-h-0 flex-1">
				<PanelStack
					withHandle
					stackRef={stackRef}
					className="h-full"
					headerHeight={30}
					sections={sections}
				/>
			</div>
			<PanelStatusBar
				left={
					<>
						<StatusCrumb active={!entryKey}>Plugins</StatusCrumb>
						{entryKey ? <StatusCrumb active>{entryKey}</StatusCrumb> : null}
					</>
				}
				right="a plugin brings the task types a plan is written in"
			/>
		</div>
	);
}
