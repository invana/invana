/**
 * The People section — the Graph's members and its service accounts, each
 * with the groups, policies and tokens it holds.
 */

import { EmptyState } from "@invana/ui";
import { SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";

export function PeoplePage(_props: SectionPageProps) {
	return (
		<SectionPage section="people">
			<EmptyState className="h-full" title="No people to show yet" />
		</SectionPage>
	);
}
