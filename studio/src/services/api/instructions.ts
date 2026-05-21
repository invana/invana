import type {
	Instruction,
	InstructionCreate,
	InstructionListResponse,
	InstructionUpdate,
} from "../../types/instructions";
import { request } from "./client";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/instructions`;
}

export const instructionsApi = {
	list: (username: string, graphSlug: string) =>
		request<InstructionListResponse>(base(username, graphSlug)),

	get: (username: string, graphSlug: string, id: string) =>
		request<Instruction>(`${base(username, graphSlug)}/${id}`),

	create: (username: string, graphSlug: string, data: InstructionCreate) =>
		request<Instruction>(base(username, graphSlug), {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (
		username: string,
		graphSlug: string,
		id: string,
		data: InstructionUpdate,
	) =>
		request<Instruction>(`${base(username, graphSlug)}/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/${id}`, { method: "DELETE" }),
};
