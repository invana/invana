import { sessionsApi } from "@invana-studio/assistant";
import {
	formatRelativeTime,
	type GraphRef,
	type SearchHit,
} from "@invana-studio/core";
import { MessageSquare } from "lucide-react";

/**
 * ⌘K's Explorer records: the Graph's conversations, newest first. Many share
 * a title, so each carries its age.
 */
export async function searchExplorer(graph: GraphRef): Promise<SearchHit[]> {
	const { items } = await sessionsApi.list(graph.username, graph.graphSlug, {
		limit: 100,
	});
	return items.map((s) => ({
		id: s.id,
		label: s.title,
		detail: `conversation · ${formatRelativeTime(s.updatedAt)}`,
		icon: MessageSquare,
		to: s.id,
	}));
}
