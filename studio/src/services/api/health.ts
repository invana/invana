import { request } from "./client";

export interface HealthResponse {
	status: "healthy" | "unhealthy";
	app_name: string;
	version: string;
	database: "connected" | "disconnected";
}

// `/health` lives outside the /api/v1 prefix — call it at the engine root.
export const healthApi = {
	get: () => request<HealthResponse>("/health"),
};
