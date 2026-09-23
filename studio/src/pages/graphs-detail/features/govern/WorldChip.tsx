/**
 * C1 · the world a question is asked under — the chip in `header.right`.
 *
 * *As someone about to ask, I want to say which factors the answer may rest on
 * before I ask, so that I am choosing what it depends on rather than
 * discovering it afterwards.*
 *
 * **It is in the header, not the composer**
 * ([WO5](../../../../../docs/for-developers/modules/govern/features/worlds.md)).
 * The world is the run's circumstances, not part of the question — and it must
 * be readable on a surface that has no composer, because a run opened from a
 * schedule has none.
 *
 * **It reads `Everything` when nothing is picked**, which is a real world and
 * the default one ([GV7](../../../../../docs/for-developers/modules/govern/spec.md))
 * — never a blank or a *choose…*, which would make the widest state look like
 * an unanswered question.
 *
 * **A world naming a version that has since been unpublished says so, and
 * picking it is refused here** — before a run opens rather than after it fails.
 * The refusal names the version, because *not permitted* with nothing to act on
 * is not a decision anybody can make
 * ([GR4](../../../../../docs/for-developers/modules/govern/features/guardrails.md)).
 */

import {
	useLensesQuery,
	useParticipantsQuery,
} from "@/hooks/queries/useGovern";
import { matches } from "@/pages/graphs-detail/features/govern/addressing";
import type { Lens } from "@/types/govern";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	LensChip,
} from "@invana/ui";
import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

/**
 * The rules GR13 resolves — a model version is the one participant a world can
 * name that the Graph can stop publishing underneath it.
 */
const MODEL_PREFIX = "graph_data/model/";

export interface WorldChipProps {
	username?: string;
	graphSlug?: string;
	lensId: string | null;
	onPick: (lensId: string | null) => void;
	/** Open the Govern panel — *Manage worlds…* at the foot of the menu. */
	onManage: () => void;
}

export function WorldChip({
	username,
	graphSlug,
	lensId,
	onPick,
	onManage,
}: WorldChipProps) {
	const { data } = useLensesQuery(username, graphSlug);
	const catalogue = useParticipantsQuery(username, graphSlug);

	const worlds = useMemo(
		() => (data?.items ?? []).filter((l) => l.kind === "world"),
		[data],
	);
	const picked = worlds.find((l) => l.id === lensId) ?? null;

	// What each world names that the Graph no longer has. Resolved against the
	// live catalogue (GV21) rather than stored, because a version is unpublished
	// long after the world that named it was written.
	//
	// **A wildcard is checked like any other pattern.** `Deals@*` is the form
	// the picker teaches — *every published version, survives the next publish*
	// ([addressing.ts](./addressing.ts)) — so exempting patterns that contain a
	// `*` would exempt almost every world anyone authors, and GR13 would refuse
	// nothing. It is the *resolution* that decides: a pattern reaching no live
	// participant names something this Graph no longer publishes.
	//
	// **Scoped to `graph_data/model/…`**, which is what GR13 is about. A layer
	// with nothing configured is not a stale world: `third_party` is
	// deliberately empty until endpoints are rows of their own, so an allow that
	// reaches into it matches nothing and is still perfectly askable.
	const stale = useMemo(() => {
		const addresses = (catalogue.data?.items ?? []).map((p) => p.address);
		if (!addresses.length) return new Map<string, string[]>();
		const out = new Map<string, string[]>();
		for (const world of worlds) {
			const missing = (world.rules ?? [])
				.filter((r) => r.allow && r.match.startsWith(MODEL_PREFIX))
				.map((r) => r.match)
				.filter((match) => !addresses.some((a) => matches(match, a)));
			if (missing.length) out.set(world.id, missing);
		}
		return out;
	}, [worlds, catalogue.data]);

	const pick = (world: Lens | null) => {
		const missing = world ? stale.get(world.id) : undefined;
		if (world && missing?.length) {
			// Refused **before a run opens**, naming the version — not silently
			// narrowed away at run time into an answer nobody can explain.
			toast.error(
				`${world.display_name} names ${missing[0]}, which this Graph no longer publishes. Edit the world, or ask under another one.`,
			);
			return;
		}
		onPick(world?.id ?? null);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<span>
					<LensChip
						lens={
							picked ? { name: picked.display_name, kind: "world" } : undefined
						}
						onPick={() => {}}
					/>
				</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-56">
				<DropdownMenuLabel>Ask under</DropdownMenuLabel>
				<DropdownMenuItem onSelect={() => pick(null)}>
					<span className="flex min-w-0 flex-col">
						<span>Everything</span>
						<span className="text-sm text-muted-foreground">
							the whole model, inside the guardrails
						</span>
					</span>
				</DropdownMenuItem>
				{worlds.length ? <DropdownMenuSeparator /> : null}
				{worlds.map((world) => {
					const missing = stale.get(world.id);
					return (
						<DropdownMenuItem key={world.id} onSelect={() => pick(world)}>
							<span className="flex min-w-0 flex-col">
								<span className="flex items-center gap-1.5">
									{missing?.length ? (
										<AlertTriangle className="size-3 text-warning" />
									) : null}
									{world.display_name}
								</span>
								{missing?.length ? (
									<span className="text-sm text-warning">
										names {missing[0]}, no longer published
									</span>
								) : world.usage?.runs ? (
									<span className="text-sm text-muted-foreground">
										used in {world.usage.runs} run
										{world.usage.runs === 1 ? "" : "s"}
									</span>
								) : null}
							</span>
						</DropdownMenuItem>
					);
				})}
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={onManage}>Manage worlds…</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
