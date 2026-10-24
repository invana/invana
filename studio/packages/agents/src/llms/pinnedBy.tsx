/**
 * Who names one model address — read where the names live, and drawn as links
 * where the record has a page.
 *
 * **Pinned by is read where pins live**: the engine's pins read lists the
 * agents, the current published skill versions and the eval judges pinned to
 * each address; the worlds whose `cast` names it are read off the lens list.
 * Each becomes one `Pinner` — its words, and how to open it when it has a page
 * in Agents. A world's page is Govern's, so a world is words only.
 */

import { Button } from "@invana/ui";
import type { Lens } from "@invana-studio/core";
import { Fragment } from "react";
import type { ModelPin } from "../fleet/types";
import type { AgentsOpen } from "../open";

export interface Pinner {
	key: string;
	label: string;
	/** Opens the pinner's page; absent when it has none in Agents. */
	open?: () => void;
}

/**
 * Which worlds name each address in their `cast`, read off the lens list —
 * never a counter, which can disagree with the rows it counts.
 */
export function castByAddress(lenses: Lens[]): Map<string, string[]> {
	const out = new Map<string, string[]>();
	for (const lens of lenses) {
		for (const address of Object.values(lens.cast ?? {})) {
			if (!address) continue;
			const names = out.get(address) ?? [];
			// A world can cast one address in two roles; it is one world either way.
			if (!names.includes(lens.display_name)) names.push(lens.display_name);
			out.set(address, names);
		}
	}
	return out;
}

/** One address's pinners: agents, skills, judges, then the worlds that cast it. */
export function pinnersOf(
	pin: ModelPin | undefined,
	worlds: string[],
	open: AgentsOpen,
): Pinner[] {
	return [
		...(pin?.agents ?? []).map((a) => ({
			key: `agent:${a.id}`,
			label: a.name,
			open: () => open.agent(a.id),
		})),
		...(pin?.skills ?? []).map((s) => ({
			key: `skill:${s.id}`,
			label: `${s.name} v${s.version}`,
			open: () => open.skill(s.id),
		})),
		...(pin?.judges ?? []).map((j) => ({
			key: `judge:${j.subject_kind}:${j.subject_id}`,
			label: `${j.name} evals judge`,
			open:
				j.subject_kind === "agent"
					? () => open.agent(j.subject_id)
					: j.subject_kind === "skill"
						? () => open.skill(j.subject_id)
						: undefined,
		})),
		...worlds.map((w) => ({ key: `world:${w}`, label: `the ${w} world` })),
	];
}

/** `Route Auditor · Fare Lead · the evals judge`, each with a page a link. */
export function PinnedBy({ pinners }: { pinners: Pinner[] }) {
	if (!pinners.length) return <span className="text-muted-foreground">—</span>;
	return (
		<span>
			{pinners.map((p, i) => (
				<Fragment key={p.key}>
					{i ? " · " : null}
					{p.open ? (
						<Button
							type="button"
							variant="link"
							size="sm"
							className="h-auto p-0"
							onClick={(e) => {
								e.stopPropagation();
								p.open?.();
							}}
						>
							{p.label}
						</Button>
					) : (
						p.label
					)}
				</Fragment>
			))}
		</span>
	);
}
