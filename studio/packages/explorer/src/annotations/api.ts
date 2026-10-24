import { request } from "@invana-studio/core";

/**
 * The engine's annotation routes (docs/for-developers/modules/explore/features/annotations.md § Engine),
 * under `/api/v1/u/{username}/{graphSlug}/annotations`. Shapes are the wire's, snake_case.
 */

type AnnotationKindDto = "note" | "value" | "highlight" | "group";
type AnnotationColorDto = "amber" | "blue" | "green" | "red" | "grey";

interface AnnotationRecordDto {
	id: string;
	kind: "node" | "edge";
	label: string;
}

export interface AnnotationDto {
	id: string;
	kind: AnnotationKindDto;
	records: AnnotationRecordDto[];
	prop: string | null;
	value_then: unknown;
	text: string;
	label: string;
	color: AnnotationColorDto;
	author: { id: string | null; name: string; kind: "user" | "assistant" };
	session_id: string | null;
	message_id: string | null;
	reach: "session" | "graph";
	promoted_by_id: string | null;
	evidence: Record<string, unknown> | null;
	created_at: string;
	updated_at: string;
}

export interface AnnotationCreateBody {
	kind: AnnotationKindDto;
	records: AnnotationRecordDto[];
	prop?: string;
	value_then?: unknown;
	text: string;
	label?: string;
	color?: AnnotationColorDto;
	session_id?: string;
}

export interface AnnotationUpdateBody {
	text?: string;
	label?: string;
	color?: AnnotationColorDto;
	reach?: "graph";
}

const base = (username: string, graphSlug: string) =>
	`/api/v1/u/${username}/${graphSlug}/annotations`;

export const annotationsApi = {
	/** The graph's annotations a member may see — every record, so the panel can list what is elsewhere. */
	list: (
		username: string,
		graphSlug: string,
		opts: {
			session?: string | null;
			scope?: "session" | "graph" | "all";
			limit?: number;
		} = {},
	) => {
		const q = new URLSearchParams();
		if (opts.session) q.set("session", opts.session);
		q.set("scope", opts.scope ?? "graph");
		q.set("limit", String(opts.limit ?? 1000));
		return request<{ items: AnnotationDto[]; total: number }>(
			`${base(username, graphSlug)}?${q.toString()}`,
		);
	},
	create: (username: string, graphSlug: string, body: AnnotationCreateBody) =>
		request<AnnotationDto>(base(username, graphSlug), {
			method: "POST",
			body: JSON.stringify(body),
		}),
	update: (
		username: string,
		graphSlug: string,
		id: string,
		body: AnnotationUpdateBody,
	) =>
		request<AnnotationDto>(`${base(username, graphSlug)}/${id}`, {
			method: "PATCH",
			body: JSON.stringify(body),
		}),
	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/${id}`, { method: "DELETE" }),
};
