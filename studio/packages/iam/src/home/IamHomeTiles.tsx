/**
 * Home's tiles under the centred composer (board `iam.home`) — one per
 * section, in the rail's order: the section's rail icon, its name, and the
 * engine's overview line (`…/iam/overview`). A tile reads `—` until the
 * overview arrives, and stays `—` if it cannot be read: a count is never made
 * in the browser. A tile opens its section as a tab.
 *
 * The composer above them is the host's.
 */

import {
	Eyebrow,
	Item,
	ItemContent,
	ItemDescription,
	ItemTitle,
} from "@invana/ui";
import { useIamOpen } from "../open";
import { useIamOverviewQuery } from "../queries";
import { type IamSectionKey, SECTIONS } from "../sections/spec";
import type { OverviewRead } from "../types";

export interface IamHomeTilesProps {
	username: string;
	graphSlug: string;
}

type TileKey = Exclude<IamSectionKey, "home" | "settings">;

const ORDER: TileKey[] = ["people", "groups", "agents", "policies", "tokens"];

const plural = (n: number, one: string, many = `${one}s`) =>
	`${n.toLocaleString()} ${n === 1 ? one : many}`;

/** Each tile's line, from the overview's counts. */
const LINES: Record<TileKey, (o: OverviewRead) => string> = {
	people: (o) =>
		`${plural(o.people, "person", "people")} · ${plural(o.service_accounts, "service account")}`,
	groups: (o) => plural(o.groups, "group"),
	agents: (o) => `${plural(o.agents, "agent")} — built in Agents`,
	policies: (o) =>
		["managed", "custom", "inline", "boundary"]
			.filter((k) => (o.policies[k] ?? 0) > 0 || k !== "inline")
			.map((k) => `${(o.policies[k] ?? 0).toLocaleString()} ${k}`)
			.join(" · "),
	tokens: (o) =>
		`${o.tokens_live.toLocaleString()} live · ${o.tokens_expiring_week.toLocaleString()} ${o.tokens_expiring_week === 1 ? "expires" : "expire"} this week`,
};

export function IamHomeTiles({ username, graphSlug }: IamHomeTilesProps) {
	const overview = useIamOverviewQuery(username, graphSlug).data;
	return (
		<div className="mt-4 flex w-full max-w-7xl flex-col gap-3">
			<Eyebrow className="justify-center">Or open</Eyebrow>
			<div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
				{ORDER.map((key) => (
					<Tile
						key={key}
						section={key}
						line={overview ? LINES[key](overview) : "—"}
					/>
				))}
			</div>
		</div>
	);
}

function Tile({ section, line }: { section: TileKey; line: string }) {
	const open = useIamOpen();
	const spec = SECTIONS[section];
	const Icon = spec.icon;
	return (
		// A card on the board's ground: the row of five fills the width under the
		// composer, and a two-line description starts its title level with the rest.
		<Item
			variant="outline"
			className="min-h-20 items-start bg-card text-left hover:bg-accent"
			asChild
		>
			<button type="button" onClick={() => open.section(section)}>
				<ItemContent>
					<ItemTitle className="font-semibold">
						<Icon className="size-4" />
						{spec.label}
					</ItemTitle>
					<ItemDescription>{line}</ItemDescription>
				</ItemContent>
			</button>
		</Item>
	);
}
