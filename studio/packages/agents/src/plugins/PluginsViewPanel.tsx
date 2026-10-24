/**
 * Plugins — everything agents can run, in one registry (agents.md).
 *
 * Two sections, stacked with no panel header above them: `Plugins` over
 * `Catalogue`. The registry lists every plugin this install loaded — kind,
 * version, task types and whether it may run — and a row opens the plugin's
 * page beside the stack. The catalogue of task types moved here from Library,
 * because the task types are what the plugins provide. `?section=` names the
 * section holding the height and `&entry=` the task type drilled into.
 */

import {
	PanelStack,
	type PanelStackHandle,
	type PanelStackSection,
} from "@invana/ui";
import { useListParams } from "@invana-studio/core";
import { useStackSections } from "@invana-studio/shell";
import {
	PanelStatusBar,
	StatusCrumb,
	useStackSectionUi,
} from "@invana-studio/ui";
import { useEffect, useRef } from "react";
import { useUrlSearchUi } from "../lists";
import { catalogueSection } from "../plans/CatalogueSection";
import { registrySection } from "./RegistrySection";

type PluginsSectionKey = "plugins" | "catalogue";

const SECTION_KEYS: readonly PluginsSectionKey[] = ["plugins", "catalogue"];
const DETAIL_PARAM: Record<PluginsSectionKey, string> = {
	plugins: "plugin",
	catalogue: "entry",
};

interface Props {
	username: string;
	graphSlug: string;
	/** A registry row — the plugin's page, beside the stack. */
	onOpenPlugin?: (name: string) => void;
}

export function PluginsViewPanel({ username, graphSlug, onOpenPlugin }: Props) {
	const stack = useStackSections<PluginsSectionKey>({
		sectionKeys: SECTION_KEYS,
		detailParam: DETAIL_PARAM,
	});
	// The registry's search and filters are the URL's; the catalogue below it
	// keeps its own search, since one address bar holds one list's filters.
	const list = useListParams();
	const ui = useUrlSearchUi(useStackSectionUi(), "plugins", list);
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
		registrySection({ ui, list, onOpenPlugin, defaultSize: size("plugins") }),
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
				right="a plugin brings the functions a plan is written in"
			/>
		</div>
	);
}
