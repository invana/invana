/**
 * C8 · the world the thread asks in — a control in the composer, between the
 * ask kind and the agent (AD15).
 *
 * *As someone asking in a thread, I want to say which factors the answers may
 * rest on, for every ask or for the next one only, so that I am choosing what
 * they depend on rather than discovering it afterwards.*
 *
 * **It reads the open session**, not the page: picking a world sets it for
 * every ask in the thread (AS5), and *Next ask only* scopes the pick to one ask
 * — the trigger wears a tag until that ask is sent (AD16).
 *
 * **It reads `Everything` when nothing is picked**, which is a real world and
 * the default one ([GV7](../../../../../../docs/for-developers/modules/govern/spec.md))
 * — and when the thread's world was deleted, it says so rather than reading as
 * though nobody had picked one (AD20).
 *
 * **A world naming a version that has since been unpublished is disabled with
 * its reason** — refused before a run opens rather than after it fails
 * ([GR13](../../../../../../docs/for-developers/modules/govern/features/guardrails.md)).
 */

import {
	useLensesQuery,
	useParticipantsQuery,
} from "@/hooks/queries/useGovern";
import { matches } from "@/pages/graphs-detail/features/govern/addressing";
import { RichSelect, type RichSelectOption } from "@invana/ui";
import { Globe, Settings2 } from "lucide-react";
import { useMemo } from "react";

/** The rules GR13 resolves — a model version is the one participant a world can
 *  name that the Graph can stop publishing underneath it. */
const MODEL_PREFIX = "graph_data/model/";
/** RichSelect is keyed by string; *Everything* is the absence of a world. */
const EVERYTHING = "__everything__";

export interface WorldPickerProps {
	username?: string;
	graphSlug?: string;
	/** What the trigger shows — the next-ask pick while one is armed. */
	lensId: string | null;
	/** The thread's world was deleted since it was picked. */
	missing?: boolean;
	nextAskOnly: boolean;
	onPick: (lensId: string | null) => void;
	onNextAskOnly: (on: boolean) => void;
	/** Open the Govern panel — *Manage worlds…* at the foot of the menu. */
	onManage: () => void;
}

export function WorldPicker({
	username,
	graphSlug,
	lensId,
	missing,
	nextAskOnly,
	onPick,
	onNextAskOnly,
	onManage,
}: WorldPickerProps) {
	const { data } = useLensesQuery(username, graphSlug);
	const catalogue = useParticipantsQuery(username, graphSlug);

	const worlds = useMemo(
		() => (data?.items ?? []).filter((l) => l.kind === "world"),
		[data],
	);

	// What each world names that the Graph no longer has, resolved against the
	// live catalogue (GV21). A wildcard is checked like any other pattern — it is
	// the *resolution* that decides — and only `graph_data/model/…` is in scope:
	// an empty layer is not a stale world.
	const stale = useMemo(() => {
		const addresses = (catalogue.data?.items ?? []).map((p) => p.address);
		if (!addresses.length) return new Map<string, string>();
		const out = new Map<string, string>();
		for (const world of worlds) {
			const missingMatch = (world.rules ?? [])
				.filter((r) => r.allow && r.match.startsWith(MODEL_PREFIX))
				.map((r) => r.match)
				.find((match) => !addresses.some((a) => matches(match, a)));
			if (missingMatch) out.set(world.id, missingMatch);
		}
		return out;
	}, [worlds, catalogue.data]);

	const options: RichSelectOption[] = [
		{
			value: EVERYTHING,
			label: "Everything",
			description: "the whole model, inside the guardrails",
		},
		...worlds.map((world) => {
			const unpublished = stale.get(world.id);
			return {
				value: world.id,
				label: world.display_name,
				description: world.usage?.runs
					? `used in ${world.usage.runs} run${world.usage.runs === 1 ? "" : "s"}`
					: undefined,
				disabled: !!unpublished,
				disabledReason: unpublished
					? `names ${unpublished}, no longer published`
					: undefined,
			};
		}),
	];

	return (
		<RichSelect
			appearance="inline"
			side="top"
			label="Ask in"
			triggerAriaLabel="World"
			triggerClassName="shrink-0"
			triggerIcon={Globe}
			triggerTag={
				nextAskOnly ? "next ask only" : missing ? "world deleted" : undefined
			}
			tooltip={
				missing && !nextAskOnly
					? "This thread's world was deleted — it asks in Everything now."
					: undefined
			}
			value={lensId ?? EVERYTHING}
			onChange={(v) => onPick(v === EVERYTHING ? null : (v as string))}
			options={options}
			toggles={[
				{
					id: "next-ask-only",
					label: "Next ask only",
					checked: nextAskOnly,
					onCheckedChange: onNextAskOnly,
				},
			]}
			actions={[
				{
					id: "manage",
					label: "Manage worlds…",
					icon: Settings2,
					onSelect: onManage,
				},
			]}
		/>
	);
}
