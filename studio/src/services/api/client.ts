/**
 * HTTP client — axios instance with auth interceptors.
 *
 * Request: attaches `Authorization: Bearer <access_token>` from the auth store.
 * Response: on 401, single-flights a /auth/refresh; on success retries the
 * original request; on failure clears the session — Studio's ProtectedRoute
 * bounces the user to /login on next render.
 */

import axios, {
	type AxiosError,
	type AxiosInstance,
	type AxiosRequestConfig,
	type InternalAxiosRequestConfig,
} from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8200";

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

interface AuthAccess {
	getAccessToken: () => string | null;
	getRefreshToken: () => string | null;
	setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
	clear: () => void;
}

let authAccess: AuthAccess | null = null;

/**
 * The auth store registers itself here (avoids a circular import — the store
 * imports the client; the client must not import the store).
 */
export function registerAuthAccess(access: AuthAccess): void {
	authAccess = access;
}

export const apiClient: AxiosInstance = axios.create({
	baseURL: BASE_URL,
	headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
	const token = authAccess?.getAccessToken();
	if (token) {
		config.headers.set("Authorization", `Bearer ${token}`);
	}
	return config;
});

// Single-flight refresh: concurrent 401s coalesce onto one /auth/refresh call.
let refreshInflight: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
	if (refreshInflight) return refreshInflight;
	const refreshToken = authAccess?.getRefreshToken();
	if (!refreshToken) return null;
	refreshInflight = (async () => {
		try {
			const res = await axios.post<{
				access_token: string;
				refresh_token: string;
			}>(`${BASE_URL}/api/v1/auth/refresh`, { refresh_token: refreshToken });
			authAccess?.setTokens({
				accessToken: res.data.access_token,
				refreshToken: res.data.refresh_token,
			});
			return res.data.access_token;
		} catch {
			authAccess?.clear();
			return null;
		} finally {
			refreshInflight = null;
		}
	})();
	return refreshInflight;
}

apiClient.interceptors.response.use(
	(res) => res,
	async (error: AxiosError) => {
		const config = error.config as
			| (InternalAxiosRequestConfig & { _retried?: boolean })
			| undefined;
		const status = error.response?.status;
		const isAuthPath = config?.url?.includes("/api/v1/auth/");

		if (status === 401 && config && !config._retried && !isAuthPath) {
			const newToken = await attemptRefresh();
			if (newToken) {
				config._retried = true;
				config.headers.set("Authorization", `Bearer ${newToken}`);
				return apiClient.request(config);
			}
		}

		const detail =
			(error.response?.data as { detail?: string } | undefined)?.detail ??
			error.message;
		throw new ApiError(status ?? 0, detail);
	},
);

/**
 * Backwards-compatible `request<T>` helper so existing services
 * (`graphs.ts`, `schemas.ts`) keep working unchanged.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const method = (init?.method ?? "GET").toUpperCase();
	const data =
		init?.body != null
			? typeof init.body === "string"
				? JSON.parse(init.body)
				: init.body
			: undefined;
	const config: AxiosRequestConfig = {
		url: path,
		method,
		data,
		headers: init?.headers as Record<string, string> | undefined,
	};
	const res = await apiClient.request<T>(config);
	if (res.status === 204) return undefined as T;
	return res.data;
}
