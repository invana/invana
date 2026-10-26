/**
 * **Graph settings** — the Graph's own configuration as a page of the
 * Modeller, at `/modeller/settings` (graph-settings.md).
 *
 * *As a modeller, I want the Graph's name, instructions, connection and
 * members on one page, so that the Graph is grounded and reachable.*
 *
 * | Tab | What it answers | Body |
 * |---|---|---|
 * | Basic | what is this Graph called, and what is it for | name · description · instructions · archive; the setup timeline while setup is unfinished |
 * | Database | what database does it read | the connection's summary, then its fields behind a passing test |
 * | Members | who is on it, and what each may change | members and the roles key side by side |
 *
 * `?tab=` carries the open tab, `basic` when it names none. What the Graph's
 * agents think with (`Agents › LLMs`) and how many may run at once
 * (`Agents › Settings`) are the Agents product's, so neither is a tab here.
 *
 * *Add member* is the page's act while Members is open, so the dialog's state
 * lives here and the tab is handed it.
 */

import { useGraphQuery } from "@invana-studio/core";
import { ActButton, useLeftSection } from "@invana-studio/shell";
import { SectionBody, SectionFrame } from "@invana-studio/ui";
import { Settings, UserPlus } from "lucide-react";
import { useState } from "react";
import { BasicTab } from "./BasicTab";
import { DatabaseTab } from "./DatabaseTab";
import { MembersTab } from "./MembersTab";

const TABS = [
	{ key: "basic", label: "Basic" },
	{ key: "database", label: "Database" },
	{ key: "members", label: "Members" },
] as const;
type SettingsTab = (typeof TABS)[number]["key"];

const isTab = (t: string | null): t is SettingsTab =>
	TABS.some((x) => x.key === t);

interface Props {
	username: string;
	graphSlug: string;
}

export function GraphSettingsPage({ username, graphSlug }: Props) {
	const { tab, setSection } = useLeftSection();
	const { data: graph } = useGraphQuery(username, graphSlug);
	const [adding, setAdding] = useState(false);
	const active: SettingsTab = isTab(tab) ? tab : "basic";

	return (
		<SectionFrame
			label="Graph settings"
			icon={Settings}
			description={`${graph?.name ?? graphSlug} — what it is called, the database it reads, and who may change it.`}
			tabs={[...TABS]}
			tab={active}
			onTab={(next) => setSection("settings", next)}
			actions={
				active === "members" ? (
					<ActButton area="settings" size="sm" onClick={() => setAdding(true)}>
						<UserPlus />
						Add member
					</ActButton>
				) : null
			}
		>
			{active === "members" ? (
				<SectionBody>
					<MembersTab
						graph={{ username, graphSlug }}
						adding={adding}
						onAddingChange={setAdding}
					/>
				</SectionBody>
			) : (
				<div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
					{active === "basic" ? (
						<BasicTab username={username} graphSlug={graphSlug} />
					) : (
						<DatabaseTab username={username} graphSlug={graphSlug} />
					)}
				</div>
			)}
		</SectionFrame>
	);
}
