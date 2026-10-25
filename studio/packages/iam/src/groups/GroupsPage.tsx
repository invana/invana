/**
 * The Groups section — the Graph's groups, their members and the policies
 * attached to each.
 */

import { EmptyState } from "@invana/ui";
import { SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";

export function GroupsPage(_props: SectionPageProps) {
	return (
		<SectionPage section="groups">
			<EmptyState className="h-full" title="No groups to show yet" />
		</SectionPage>
	);
}
