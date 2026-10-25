/**
 * The frame every Agents section page draws the same way — the shared
 * `SectionFrame`, filled from this product's sections table: a head with the
 * section's own rail icon, its name, its chips and its acts; a line saying
 * what the page holds; the section's tabs when it has them; and the body,
 * scrolling under them.
 *
 * A tab is the path's last segment (`/agents/fleet/map`), so `onTab` moves
 * the path and a reload lands on the same tab.
 *
 *     <SectionPage section="fleet" tab={tab} onTab={onTab} actions={…}>
 *       …
 *     </SectionPage>
 */

import { SectionFrame } from "@invana-studio/ui";
import type { ReactNode } from "react";
import { type AgentsSectionKey, SECTIONS } from "./spec";

export { SectionBody } from "@invana-studio/ui";

interface SectionPageProps {
	section: AgentsSectionKey;
	/** The open tab; ignored by a section with none. */
	tab?: string;
	onTab?: (tab: string) => void;
	/** Beside the name — a count the engine returned, a state. */
	chips?: ReactNode;
	/** The page's acts, at the head's right. */
	actions?: ReactNode;
	children: ReactNode;
}

export function SectionPage({ section, ...props }: SectionPageProps) {
	return <SectionFrame {...SECTIONS[section]} {...props} />;
}
