import type { GraphRef, SearchHit } from "@invana-studio/core";
import { FolderOpen, ListTodo } from "lucide-react";
import { projectsApi, todosApi } from "./api";

/** ⌘K's Projects records: the Graph's projects and its todos, each at its own path. */
export async function searchProjects(graph: GraphRef): Promise<SearchHit[]> {
	const [projects, todos] = await Promise.all([
		projectsApi.list(graph.username, graph.graphSlug),
		todosApi.list(graph.username, graph.graphSlug),
	]);
	return [
		...projects.items.map((p) => ({
			id: p.id,
			label: p.name,
			detail: p.status === "archived" ? "project · archived" : "project",
			icon: FolderOpen,
			to: encodeURIComponent(p.key),
		})),
		...todos.items.map((t) => ({
			id: t.id,
			label: t.title,
			detail: "todo",
			icon: ListTodo,
			to: `todos/${encodeURIComponent(t.id)}`,
		})),
	];
}
