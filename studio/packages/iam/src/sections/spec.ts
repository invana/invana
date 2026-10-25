/**
 * The IAM sections — what the rail names, what each page holds. One table,
 * read by the rail (`product.tsx`), the section frame (`SectionPage`), the
 * workbook's tabs and Home's tiles, so a section's name and icon cannot
 * differ between them.
 *
 * No section has path tabs: a kind (person · service, managed · custom ·
 * inline · boundary) is a filter inside the page, `?f.kind=`.
 *
 * The keys here are IAM's own. The path's `panel` key is prefixed —
 * `iam/agents` is panel `iam-agents` — so nothing collides with the Agents
 * product's `agents` or `home`; `panelOf` and `sectionOfPanel` are the one
 * place the two meet.
 */

import type { ProductIcon } from "@invana-studio/core";
import {
	Bot,
	House,
	KeyRound,
	ScrollText,
	Settings,
	Users,
	UsersRound,
} from "lucide-react";

export type IamSectionKey =
	| "home"
	| "people"
	| "groups"
	| "agents"
	| "policies"
	| "tokens"
	| "settings";

export interface IamSectionSpec {
	label: string;
	icon: ProductIcon;
	/** One line under the page's name: what it holds. */
	description: string;
}

export const SECTIONS: Record<IamSectionKey, IamSectionSpec> = {
	home: {
		label: "Home",
		icon: House,
		description: "Ask, or open a section",
	},
	people: {
		label: "People",
		icon: Users,
		description:
			"Members of this Graph, and service accounts — a person with no sign-in that owns tokens for scripts",
	},
	groups: {
		label: "Groups",
		icon: UsersRound,
		description: "Attach a policy once, to a team",
	},
	agents: {
		label: "Agents",
		icon: Bot,
		description:
			"An agent holds policies like a person does — it is built in Agents. Workers hold none — they only run steps",
	},
	policies: {
		label: "Policies",
		icon: ScrollText,
		description:
			"A policy says what may be done, to which resources, within which limits. People, groups, agents and tokens hold them",
	},
	tokens: {
		label: "Tokens",
		icon: KeyRound,
		description:
			"A key that acts as its holder when software calls Invana — a script, CI, Claude Code. It can only narrow what its holder may do",
	},
	settings: {
		label: "Settings",
		icon: Settings,
		description:
			"This Graph's settings — its Members tab is where people join the Graph and take their roles",
	},
};

const PANEL_PREFIX = "iam-";

/** The path's `panel` key for a section: `policies` → `iam-policies`. */
export const panelOf = (key: IamSectionKey): string => `${PANEL_PREFIX}${key}`;

/** The section a `panel` key names, or null when it is not IAM's. */
export function sectionOfPanel(panel: string | null): IamSectionKey | null {
	if (!panel?.startsWith(PANEL_PREFIX)) return null;
	const key = panel.slice(PANEL_PREFIX.length);
	return key in SECTIONS ? (key as IamSectionKey) : null;
}

/** What every section page takes from the host. */
export interface SectionPageProps {
	username: string;
	graphSlug: string;
}
