/**
 * IAM's Agents section — every agent's policies, what it may call and what
 * was refused. Agents are built in Agents; this page reads them.
 */

import { EmptyState } from "@invana/ui";
import { SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";

export function IamAgentsPage(_props: SectionPageProps) {
	return (
		<SectionPage section="agents">
			<EmptyState className="h-full" title="No agents to show yet" />
		</SectionPage>
	);
}
