/**
 * The frame every Agents section page draws the same way: a head with the
 * section's own rail icon, its name, its chips and its acts; a line saying
 * what the page holds; the section's tabs when it has them; and the body,
 * scrolling under them.
 *
 * The head and the tabs are drawn at once — a read in flight shows in the body
 * only. A tab is the path's last segment (`/agents/fleet/map`), so `onTab`
 * moves the path and a reload lands on the same tab.
 *
 *     <SectionPage section="fleet" tab={tab} onTab={onTab} actions={…}>
 *       …
 *     </SectionPage>
 */

import { RecordHeader, Tabs, TabsList, TabsTrigger } from "@invana/ui";
import type { ReactNode } from "react";
import { type AgentsSectionKey, SECTIONS } from "./spec";

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

export function SectionPage({
	section,
	tab,
	onTab,
	chips,
	actions,
	children,
}: SectionPageProps) {
	const spec = SECTIONS[section];
	const Icon = spec.icon;
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="shrink-0 border-b">
				<RecordHeader
					size="lg"
					variant="page"
					icon={<Icon />}
					crumbs={[spec.label]}
					chips={chips}
					actions={actions}
				/>
				<p className="px-4 pb-2 text-muted-foreground">{spec.description}</p>
				{spec.tabs.length > 0 && (
					<Tabs
						size="sm"
						value={tab ?? spec.tabs[0].key}
						onValueChange={(value) => onTab?.(value)}
					>
						<TabsList className="w-full justify-start gap-1 px-3 pb-1">
							{spec.tabs.map((t) => (
								<TabsTrigger key={t.key} value={t.key}>
									{t.label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				)}
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
		</div>
	);
}

/** A section page's body column — the padding and the gap between its cards. */
export function SectionBody({ children }: { children: ReactNode }) {
	return <div className="flex flex-col gap-3 p-3">{children}</div>;
}
