/**
 * The board's annotations, from the engine — what `GraphBoard` draws and
 * writes back through (docs/for-developers/modules/explore/features/annotations.md).
 *
 * One query per Graph: every annotation the member may see, so the board draws
 * those on what it loaded and the panel lists the rest as *elsewhere in this
 * graph*. A write invalidates it; the board shows the result when it lands.
 */

import type {
	AnnotationDraft,
	AnnotationPatch,
	BoardAnnotation,
} from "@invana/canvas-ui";
import type { AuthorTone } from "@invana/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { type AnnotationDto, annotationsApi } from "./api";

const TONES: AuthorTone[] = ["success", "warning", "info", "primary"];

/** A stable tint per person, so the same writer reads the same everywhere. */
function toneOf(id: string | null): AuthorTone {
	if (!id) return "muted";
	let h = 0;
	for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
	return TONES[h % TONES.length] ?? "primary";
}

/** `2 Oct`, the way a card's foot says when. */
function when(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** An engine row as the board draws it, for the member looking. */
function toBoardAnnotation(
	a: AnnotationDto,
	me: string | null,
	sessionTitle?: (id: string) => string,
): BoardAnnotation {
	const assistant = a.author.kind === "assistant";
	const mine = !assistant && a.author.id !== null && a.author.id === me;
	const ownSession = assistant && a.author.id === me;
	return {
		id: a.id,
		kind: a.kind,
		records: a.records,
		prop: a.prop,
		valueThen: a.value_then,
		text: a.text,
		label: a.label,
		color: a.color,
		author: assistant
			? { id: null, name: "Assistant", kind: "assistant" }
			: {
					id: a.author.id,
					name: mine ? "You" : a.author.name,
					kind: "person",
					...(mine ? { initials: "Y" } : {}),
					tone: mine ? "primary" : toneOf(a.author.id),
				},
		meta: when(a.created_at),
		sessionTag:
			a.reach === "session" && a.session_id
				? (sessionTitle?.(a.session_id) ?? "This session")
				: null,
		canEdit: mine,
		canDelete: mine || ownSession,
		...(mine || ownSession
			? {}
			: { whyNot: `Only ${a.author.name} can delete it` }),
	};
}

const key = (username: string, graphSlug: string) =>
	["annotations", username, graphSlug] as const;

export interface UseBoardAnnotations {
	annotations: BoardAnnotation[];
	onCreate: (draft: AnnotationDraft) => Promise<unknown>;
	onUpdate: (id: string, patch: AnnotationPatch) => Promise<unknown>;
	onDelete: (id: string) => Promise<unknown>;
}

export function useBoardAnnotations(
	username: string,
	graphSlug: string,
	opts: { me: string | null; sessionId: string | null },
): UseBoardAnnotations {
	const qc = useQueryClient();
	const k = key(username, graphSlug);
	const query = useQuery({
		queryKey: [...k, opts.sessionId ?? ""],
		queryFn: () =>
			annotationsApi.list(username, graphSlug, {
				session: opts.sessionId,
				scope: "graph",
			}),
		enabled: !!username && !!graphSlug,
	});
	const settle = () => qc.invalidateQueries({ queryKey: k });
	const create = useMutation({
		mutationFn: (d: AnnotationDraft) =>
			annotationsApi.create(username, graphSlug, {
				kind: d.kind,
				records: d.records.map((r) => ({
					id: r.id,
					kind: r.kind,
					label: r.label ?? "",
				})),
				...(d.prop ? { prop: d.prop } : {}),
				...(d.valueThen !== undefined ? { value_then: d.valueThen } : {}),
				text: d.text,
				...(d.label ? { label: d.label } : {}),
				color: d.color,
				...(opts.sessionId ? { session_id: opts.sessionId } : {}),
			}),
		onSettled: settle,
	});
	const update = useMutation({
		mutationFn: ({ id, patch }: { id: string; patch: AnnotationPatch }) =>
			annotationsApi.update(username, graphSlug, id, patch),
		onSettled: settle,
	});
	const remove = useMutation({
		mutationFn: (id: string) => annotationsApi.remove(username, graphSlug, id),
		onSettled: settle,
	});

	const annotations = useMemo(
		() => (query.data?.items ?? []).map((a) => toBoardAnnotation(a, opts.me)),
		[query.data, opts.me],
	);
	return {
		annotations,
		onCreate: (d) => create.mutateAsync(d),
		onUpdate: (id, patch) => update.mutateAsync({ id, patch }),
		onDelete: (id) => remove.mutateAsync(id),
	};
}
