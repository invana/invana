/**
 * The body of one IAM section tab — the section key picks the page, and every
 * page takes the same props from the host. Home has no tab: the host draws it
 * when nothing is open.
 */

import { IamAgentsPage } from "../agents/IamAgentsPage";
import { GroupsPage } from "../groups/GroupsPage";
import { PeoplePage } from "../people/PeoplePage";
import { PoliciesPage } from "../policies/PoliciesPage";
import { IamSettingsPage } from "../settings/IamSettingsPage";
import { TokensPage } from "../tokens/TokensPage";
import type { IamSectionKey, SectionPageProps } from "./spec";

const PAGES = {
	people: PeoplePage,
	groups: GroupsPage,
	agents: IamAgentsPage,
	policies: PoliciesPage,
	tokens: TokensPage,
	settings: IamSettingsPage,
} satisfies Record<
	Exclude<IamSectionKey, "home">,
	(props: SectionPageProps) => unknown
>;

export function IamSectionBody({
	section,
	...props
}: SectionPageProps & { section: Exclude<IamSectionKey, "home"> }) {
	const Page = PAGES[section];
	return <Page {...props} />;
}
