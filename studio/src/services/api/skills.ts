import type {
	Skill,
	SkillCreate,
	SkillListResponse,
	SkillUpdate,
} from "../../types/skills";
import { request } from "./client";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/skills`;
}

export const skillsApi = {
	list: (username: string, graphSlug: string) =>
		request<SkillListResponse>(base(username, graphSlug)),

	get: (username: string, graphSlug: string, id: string) =>
		request<Skill>(`${base(username, graphSlug)}/${id}`),

	create: (username: string, graphSlug: string, data: SkillCreate) =>
		request<Skill>(base(username, graphSlug), {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (
		username: string,
		graphSlug: string,
		id: string,
		data: SkillUpdate,
	) =>
		request<Skill>(`${base(username, graphSlug)}/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/${id}`, { method: "DELETE" }),
};
