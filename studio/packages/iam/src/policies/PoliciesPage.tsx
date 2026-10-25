/**
 * The Policies section — every policy of this Graph by kind, who holds it and
 * what it allows.
 */

import { EmptyState } from "@invana/ui";
import { SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";

export function PoliciesPage(_props: SectionPageProps) {
	return (
		<SectionPage section="policies">
			<EmptyState className="h-full" title="No policies to show yet" />
		</SectionPage>
	);
}
