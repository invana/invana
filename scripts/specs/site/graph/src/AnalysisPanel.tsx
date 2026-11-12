/**
 * The Analysis side panel: the parser's loops, blocking chains, blockers, gaps and orphans, and what the graph is
 * highlighting now.
 *
 * Every list is `analysis` from `specs-graph.json` as the parser wrote it — the panel counts and lists it, never
 * recomputes it. A row highlights its nodes on the canvas; each section links to the site page that lists it in full
 * (`/loops`, `/loops#chains`, `/gaps`, `/orphans`). The *Highlight* section names the current highlight — a row from
 * here, a blast radius or a path from a node's right-click menu — with *Clear*.
 */
import {
	Button,
	Item,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
	ScrollArea,
	SectionHeader,
} from "@invana/ui";
import { ExternalLink, X } from "lucide-react";
import type { ReactNode } from "react";
import { openPage } from "./nav";
import type { Analysis } from "./thinking";

/** What the canvas emphasises now. */
export interface Highlight {
	label: string;
	ids: string[];
}

interface Props {
	analysis: Analysis;
	highlight: Highlight | null;
	onHighlight: (h: Highlight | null) => void;
}

/** How the site's `/gaps` page words each gap. */
export const GAP_TEXT: Record<string, string> = {
	"no-engine": "no Engine section",
	"placeholder-engine": "Engine is a placeholder",
	"no-system-impact": "no System impact section",
	"placeholder-system-impact": "System impact is a placeholder",
	"no-nfrs": "no NFRs",
};

/** The gaps of each feature, in the parse's order. */
export function gapsByNode(analysis: Analysis): [string, string[]][] {
	const by = new Map<string, string[]>();
	for (const g of analysis.gaps) {
		if (!by.has(g.node)) by.set(g.node, []);
		by.get(g.node)?.push(GAP_TEXT[g.gap] ?? g.gap);
	}
	return [...by];
}

export function AnalysisPanel({ analysis, highlight, onHighlight }: Props) {
	const gaps = gapsByNode(analysis);
	const row = (key: string, h: Highlight, description: string) => (
		<Item key={key} asChild size="sm" selected={highlight?.label === h.label}>
			<button type="button" onClick={() => onHighlight(h)}>
				<ItemContent>
					<ItemTitle>{h.label}</ItemTitle>
					<ItemDescription>{description}</ItemDescription>
				</ItemContent>
			</button>
		</Item>
	);
	return (
		<ScrollArea className="h-full">
			<SectionHeader
				title="Highlight"
				count={highlight ? `${highlight.ids.length} nodes` : "none"}
				actions={
					highlight && (
						<Button size="sm" variant="ghost" onClick={() => onHighlight(null)}>
							<X />
							Clear
						</Button>
					)
				}
			/>
			<ItemGroup className="p-2">
				<Item size="sm" variant="muted">
					<ItemContent>
						<ItemTitle>{highlight?.label ?? "Nothing highlighted"}</ItemTitle>
						<ItemDescription>
							Pick a row below, or right-click a node for its blast radius or a
							path to another node.
						</ItemDescription>
					</ItemContent>
				</Item>
			</ItemGroup>
			<Section
				title="Loops"
				count={analysis.cycles.length}
				page="loops/"
				onAll={() =>
					onHighlight({
						label: "Every loop",
						ids: analysis.cycles.flat(),
					})
				}
			>
				{analysis.cycles.map((c, i) =>
					row(
						`loop-${i}`,
						{ label: `Loop ${i + 1}`, ids: c },
						`${c.length} nodes · ${c.join(" → ")}`,
					),
				)}
			</Section>
			<Section
				title="Blocking chains"
				count={analysis.chains.length}
				page="loops/#chains"
				onAll={() =>
					onHighlight({
						label: "Every blocking chain",
						ids: analysis.chains.flat(),
					})
				}
			>
				{analysis.chains.map((c, i) =>
					row(
						`chain-${i}`,
						{ label: `Chain ${i + 1}`, ids: c },
						`${c.length} long · ${c.join(" → ")}`,
					),
				)}
			</Section>
			<Section
				title="Blockers"
				count={analysis.blockers.length}
				page="loops/"
				onAll={() =>
					onHighlight({
						label: "Every blocker",
						ids: analysis.blockers.flatMap((b) => [b.source, b.target]),
					})
				}
			>
				{analysis.blockers.map((b) =>
					row(
						`blocker-${b.source}-${b.target}`,
						{
							label: `${b.source} waits on ${b.target}`,
							ids: [b.source, b.target],
						},
						b.type,
					),
				)}
			</Section>
			<Section
				title="Gaps"
				count={gaps.length}
				page="gaps/"
				onAll={() =>
					onHighlight({
						label: "Every feature with a gap",
						ids: gaps.map(([n]) => n),
					})
				}
			>
				{gaps.map(([node, text]) =>
					row(
						`gap-${node}`,
						{ label: `${node} gaps`, ids: [node] },
						text.join(" · "),
					),
				)}
			</Section>
			<Section
				title="Orphans"
				count={analysis.orphans.length}
				page="orphans/"
				onAll={() =>
					onHighlight({ label: "Every orphan", ids: analysis.orphans })
				}
			>
				{analysis.orphans.map((o) =>
					row(`orphan-${o}`, { label: o, ids: [o] }, "no edge at all"),
				)}
			</Section>
		</ScrollArea>
	);
}

function Section({
	title,
	count,
	page,
	onAll,
	children,
}: {
	title: string;
	count: number;
	page: string;
	onAll: () => void;
	children: ReactNode;
}) {
	return (
		<section aria-label={title}>
			<SectionHeader
				title={title}
				count={count}
				actions={
					<>
						<Button
							size="sm"
							variant="ghost"
							disabled={count === 0}
							onClick={onAll}
						>
							Highlight all
						</Button>
						<Button
							size="sm"
							variant="ghost"
							aria-label={`${title} on the site`}
							onClick={() => openPage(page)}
						>
							<ExternalLink />
						</Button>
					</>
				}
			/>
			<ItemGroup className="p-2">
				{count === 0 ? (
					<Item size="sm" variant="muted">
						<ItemContent>
							<ItemDescription>None.</ItemDescription>
						</ItemContent>
					</Item>
				) : (
					children
				)}
			</ItemGroup>
		</section>
	);
}
