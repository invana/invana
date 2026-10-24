/**
 * What every tab of the skill page reads: the draft (when one is open), the
 * plan on screen, the text its spans are numbered against, and the catalogue
 * entries its functions are bound by.
 *
 * A draft is read only when one exists or a person asks to edit — `GET
 * …/draft` opens one, so reading it on a published skill would write a row.
 * The plan on screen is the draft's when there is a draft, else the head's.
 * While a draw is in flight the draft is polled; the last drawn plan stays on
 * screen until the new one lands.
 */

import { useMemo, useState } from "react";
import { useCatalogueQuery } from "../plans/queries";
import type { CatalogueEntry } from "../plans/types";
import { lineOf } from "./instructionsText";
import {
	useDrawDraftMutation,
	useSkillDraftQuery,
	useSkillPlaybookQuery,
} from "./queries";
import type { PlanHandler } from "./taskFlowFromPlan";
import type { Skill, SkillDraft, SkillPlaybookRead } from "./types";

export interface SkillPage {
	username: string;
	graphSlug: string;
	skill: Skill;
	/** A draft row exists, or a person asked to edit and one is being opened. */
	hasDraft: boolean;
	draft: SkillDraft | undefined;
	draftLoading: boolean;
	draftError: unknown;
	/** Open a draft on a published skill — *Edit instructions*. */
	startEditing: () => void;
	/** The plan on screen — the draft's, else the head's. */
	plan: SkillPlaybookRead | undefined;
	planLoading: boolean;
	planError: unknown;
	/** The version that plan was drawn from. */
	planVersion: number;
	/** The saved text the plan's spans are numbered against. */
	text: string;
	/** Where `span` reads in {@link text}, 1-based, or null. */
	lineOf: (span: string | null) => number | null;
	handlers: PlanHandler[];
	/** The sentences the last draw could not map, verbatim. */
	unmapped: string[];
	drawing: boolean;
	draw: () => void;
	drawError: unknown;
	/** Catalogue entries by function key. */
	catalogue: Map<string, CatalogueEntry>;
	catalogueEntries: CatalogueEntry[];
	catalogueLoading: boolean;
}

/** Enough to read every function at once; the catalogue is small. */
const WHOLE_CATALOGUE = { limit: 200, sort: "key" };

export function useSkillPage(
	username: string,
	graphSlug: string,
	skill: Skill,
): SkillPage {
	const [editRequested, setEditRequested] = useState<string | null>(null);
	const hasDraft =
		skill.is_draft || !!skill.draft_version_id || editRequested === skill.id;

	const drawMutation = useDrawDraftMutation(username, graphSlug, skill.id);
	const [polling, setPolling] = useState(false);
	const draft = useSkillDraftQuery(username, graphSlug, skill.id, {
		enabled: hasDraft,
		poll: polling,
	});
	const inFlight = !!draft.data?.drawing_run_id;
	const drawing = drawMutation.isPending || inFlight;
	// Poll while the engine says a draw is running, and stop when it settles.
	if (drawing !== polling) setPolling(drawing);

	const head = useSkillPlaybookQuery(
		username,
		graphSlug,
		skill.id,
		hasDraft || skill.is_draft ? null : skill.version,
	);

	const catalogueQuery = useCatalogueQuery(
		username,
		graphSlug,
		WHOLE_CATALOGUE,
	);
	const catalogueEntries = useMemo(
		() => catalogueQuery.data?.items ?? [],
		[catalogueQuery.data],
	);
	const catalogue = useMemo(
		() => new Map(catalogueEntries.map((e) => [e.step_key, e])),
		[catalogueEntries],
	);

	// A draft never drawn holds the engine's placeholder row — nothing drawn yet.
	const placeholder =
		hasDraft &&
		!!draft.data &&
		!draft.data.drawn &&
		draft.data.plan.nodes.every((n) => !n.task);
	const plan = hasDraft
		? placeholder
			? undefined
			: draft.data?.plan
		: head.data;
	const text = hasDraft ? (draft.data?.version.content ?? "") : skill.content;
	const at = useMemo(() => (span: string | null) => lineOf(text, span), [text]);

	return {
		username,
		graphSlug,
		skill,
		hasDraft,
		draft: draft.data,
		draftLoading: hasDraft && draft.isLoading,
		draftError: draft.error,
		startEditing: () => setEditRequested(skill.id),
		plan,
		planLoading: hasDraft ? draft.isLoading : head.isLoading,
		planError: hasDraft ? draft.error : head.error,
		planVersion: hasDraft
			? (draft.data?.version.version ?? skill.version)
			: skill.version,
		text,
		lineOf: at,
		handlers: plan?.handlers ?? [],
		unmapped: hasDraft ? (draft.data?.unmapped ?? []) : [],
		drawing,
		draw: () => drawMutation.mutate(),
		drawError: drawMutation.error,
		catalogue,
		catalogueEntries,
		catalogueLoading: catalogueQuery.isLoading,
	};
}

/** Publish waits on a line that cannot map, an open question and a draw. */
export function canPublish(page: SkillPage): boolean {
	return (
		page.hasDraft &&
		!!page.draft &&
		page.unmapped.length === 0 &&
		!page.draft.open_clarification &&
		!page.drawing
	);
}

/** The distinct functions a plan calls, in the order its steps first name them. */
export function planFunctions(plan: SkillPlaybookRead | undefined): string[] {
	return [...new Set((plan?.nodes ?? []).map((n) => n.task).filter(Boolean))];
}
