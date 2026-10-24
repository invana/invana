/**
 * Functions — every function agents may call, the plans made of them, the
 * templates that shape answers and the plugins they come from, as one page of
 * five tabs: Functions · Packaged plans · Promoted plans · Templates ·
 * Plugins. The tab is the path's last segment.
 *
 * The head's chips are the engine's totals — the catalogue's, the library's
 * packaged count and the registry's — never a count of rows on screen. Its
 * one act, *Promote a plan*, turns a plan that already ran and served into a
 * library entry, and opens the plan it made.
 */

import { ActButton } from "@invana-studio/shell";
import { DetailStatus } from "@invana-studio/ui";
import { GitBranchPlus } from "lucide-react";
import { useState } from "react";
import { useAgentsOpen } from "../open";
import { PromoteDialog } from "../plans/PromoteDialog";
import { useCatalogueQuery, useFlowsQuery } from "../plans/queries";
import { usePluginsQuery } from "../plugins/queries";
import { SectionBody, SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import { CatalogueTab } from "./CatalogueTab";
import { PlansTab } from "./PlansTab";
import { PluginsTab } from "./PluginsTab";
import { TemplatesTab } from "./TemplatesTab";

/** The smallest page a total is read from. */
const TOTAL = { limit: 1 };

export function FunctionsSectionPage({
	username,
	graphSlug,
	tab,
	onTab,
}: SectionPageProps) {
	const open = useAgentsOpen();
	const [promoting, setPromoting] = useState(false);
	return (
		<SectionPage
			section="functions"
			tab={tab}
			onTab={onTab}
			chips={<Totals username={username} graphSlug={graphSlug} />}
			actions={
				<ActButton
					area="build"
					size="sm"
					variant="outline"
					onClick={() => setPromoting(true)}
				>
					<GitBranchPlus />
					Promote a plan
				</ActButton>
			}
		>
			<SectionBody>
				{tab === "plans" || tab === "promoted" ? (
					<PlansTab
						username={username}
						graphSlug={graphSlug}
						origin={tab === "plans" ? "packaged" : "promoted"}
						onPromote={() => setPromoting(true)}
					/>
				) : tab === "templates" ? (
					<TemplatesTab username={username} graphSlug={graphSlug} />
				) : tab === "plugins" ? (
					<PluginsTab />
				) : (
					<CatalogueTab username={username} graphSlug={graphSlug} />
				)}
			</SectionBody>
			<PromoteDialog
				username={username}
				graphSlug={graphSlug}
				open={promoting}
				onOpenChange={setPromoting}
				onPromoted={(plan) => open.plan(plan.id)}
			/>
		</SectionPage>
	);
}

/** `44 functions · 7 packaged plans · 11 plugins` — each the engine's total. */
function Totals({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const functions = useCatalogueQuery(username, graphSlug, TOTAL).data;
	const plans = useFlowsQuery(username, graphSlug, TOTAL).data;
	const plugins = usePluginsQuery(TOTAL).data;
	return (
		<>
			{functions ? (
				<DetailStatus>{`${functions.unfiltered_total} functions`}</DetailStatus>
			) : null}
			{plans ? (
				<DetailStatus>{`${plans.packaged} packaged plans`}</DetailStatus>
			) : null}
			{plugins ? (
				<DetailStatus>{`${plugins.unfiltered_total} plugins`}</DetailStatus>
			) : null}
		</>
	);
}
