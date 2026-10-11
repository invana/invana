import type { GraphRef, SearchHit } from "@invana-studio/core";
import { Bot, Wand2 } from "lucide-react";
import { agentsApi } from "./agents/api";
import { skillsApi } from "./skills/api";

/**
 * ⌘K's Agents records: the Graph's agents, retired ones included, and its
 * skills. An agent opens its page in the Workbook; a skill has no path of
 * its own, so it opens Skills.
 */
export async function searchAgents(graph: GraphRef): Promise<SearchHit[]> {
	const [agents, skills] = await Promise.all([
		agentsApi.list(graph.username, graph.graphSlug, { includeRetired: true }),
		skillsApi.list(graph.username, graph.graphSlug),
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
			to: "skills",
		})),
	];
}
