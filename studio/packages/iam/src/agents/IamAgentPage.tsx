/**
 * An agent's access page, opened as a tab of its own
 * (`?page=iam_agent:<id>`) — the policies it holds, what it may do layer by
 * layer, who it may delegate to and what was refused. Its builder page is in
 * Agents (`useIamOpen().agentInAgents`).
 */

import { EmptyState } from "@invana/ui";

export interface IamAgentPageProps {
	username: string;
	graphSlug: string;
	/** `agents.id`. */
	agentId: string;
}

export function IamAgentPage(_props: IamAgentPageProps) {
	return <EmptyState className="h-full" title="Agent access" />;
}
