/**
 * **Approvals** — the one queue of asks an agent or a run makes of a person,
 * at `/agents/approvals` (approvals.md).
 *
 * *As an approver, I want to see exactly what a run will send before it goes,
 * so that nothing leaves without a person.*
 *
 * Two tabs, each the path's last segment:
 *
 * - **Waiting** (`/agents/approvals`) — access, budget, delegation, send and
 *   question asks, each routed to whoever owns the thing asked for
 *   ({@link WaitingTab}).
 * - **Alert rules** (`/agents/approvals/alerts`) — rules over the ledger that
 *   tell members in the inbox ({@link AlertRulesTab}).
 *
 * The bell's tray reads the same asks, so a decision here clears it there.
 */

import { SectionBody, SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import { AlertRulesTab } from "./AlertRulesTab";
import { WaitingTab } from "./WaitingTab";

export function ApprovalsPage({
	username,
	graphSlug,
	tab,
	onTab,
}: SectionPageProps) {
	return (
		<SectionPage section="approvals" tab={tab} onTab={onTab}>
			<SectionBody>
				{tab === "alerts" ? (
					<AlertRulesTab username={username} graphSlug={graphSlug} />
				) : (
					<WaitingTab username={username} graphSlug={graphSlug} />
				)}
			</SectionBody>
		</SectionPage>
	);
}
