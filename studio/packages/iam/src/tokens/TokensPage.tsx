/**
 * The Tokens section — every token that acts in this Graph, whose it is and
 * what it is narrowed to.
 */

import { EmptyState } from "@invana/ui";
import { SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";

export function TokensPage(_props: SectionPageProps) {
	return (
		<SectionPage section="tokens">
			<EmptyState className="h-full" title="No tokens to show yet" />
		</SectionPage>
	);
}
