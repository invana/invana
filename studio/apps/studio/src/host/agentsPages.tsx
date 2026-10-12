/**
 * The Agents product's pages — Overview, Performance and LLMs.
 *
 * A page is a rail item with no panel: while it is open it fills `mainSection`
 * in place of the Workbook, the way an expanded Settings does, and the left
 * column stays closed (`HostLayout` lists the keys as page-owned and the left
 * section draws nothing for them). The Workbook's pages come back with the
 * next rail item that has a panel (fleet-performance.md).
 */

import { LlmsPage, OverviewPage, PerformancePage } from "@invana-studio/agents";
import type { LeftNavKey } from "@invana-studio/shell";
import type { ReactNode } from "react";

/** The page the open rail item draws, or null when it is a panel. */
export function agentsPage(
	section: LeftNavKey | null,
	username: string | undefined,
	graphSlug: string | undefined,
): ReactNode | null {
	if (!section || !username || !graphSlug) return null;
	const graph = { username, graphSlug };
	switch (section) {
		case "overview":
			return <OverviewPage {...graph} />;
		case "performance":
			return <PerformancePage {...graph} />;
		case "llms":
			return <LlmsPage {...graph} />;
		default:
			return null;
	}
}
