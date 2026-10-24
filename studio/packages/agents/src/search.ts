import type { GraphRef, SearchHit } from "@invana-studio/core";
import { Bot, Wand2 } from "lucide-react";
import { agentsApi } from "./agents/api";
import { skillsApi } from "./skills/api";

/**
 * ⌘K's Agents records: the Graph's agents, retired ones included, and its
 * skills. Each opens its page as a tab beside its section's.
 */
export async function searchAgents(graph: GraphRef): Promise<SearchHit[]> {
	const [agents, skills] = await Promise.all([
		agentsApi.list(graph.username, graph.graphSlug, {
			filters: { status: ["active", "paused", "retired"] },
			limit: 200,
		}),
		skillsApi.list(graph.username, graph.graphSlug, { limit: 200 }),
	]);
	return [
		...agents.items.map((a) => ({
			id: a.id,
			label: a.name,
			detail: a.status === "active" ? "agent" : `agent · ${a.status}`,
			icon: Bot,
			to: `agents?page=${encodeURIComponent(`agent:${a.id}`)}`,
		})),
		...skills.items.map((s) => ({
			id: s.id,
			label: s.name,
			detail: "skill",
			icon: Wand2,
			to: `skills?page=${encodeURIComponent(`skill:${s.id}`)}`,
		})),
	];
}
