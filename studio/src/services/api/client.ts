/**
 * HTTP client — axios instance with auth interceptors.
 *
 * Request: attaches `Authorization: Bearer <access_token>` from the auth store.
 * Response: on 401, single-flights a /auth/refresh; on success retries the
 * original request; on failure clears the session — Studio's ProtectedRoute
 * bounces the user to /login on next render.
 */

import { type Span, SpanStatusCode, propagation } from "@opentelemetry/api";
import axios, {
	type AxiosError,
	type AxiosInstance,
	type AxiosRequestConfig,
	type InternalAxiosRequestConfig,
} from "axios";
import { toast } from "sonner";
import { startClientSpan } from "../telemetry/tracer";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8200";

/** Carries the per-request telemetry span from request → response interceptor. */
type TracedConfig = InternalAxiosRequestConfig & { _otelSpan?: Span };

/**
 * Standard mutation envelope (RFC-028): `{ message, data }`. The backend owns the
 * toast copy; this client toasts `message` centrally and unwraps `data` for the
 * caller. Detected by a string `message` alongside a `data` key — bare resources
 * (GET responses) and other `message`-bearing bodies (e.g. session rerun, schema
 * reconcile) lack that pairing, so they're never mistaken for an envelope.
 */
interface ActionEnvelope {
	message: string;
	data?: unknown;
}

function isActionEnvelope(body: unknown): body is ActionEnvelope {
	return (
		typeof body === "object" &&
		body !== null &&
		"data" in body &&
		typeof (body as { message?: unknown }).message === "string"
	);
}

// `suppressActionToast` raises this depth for the duration of a client-orchestrated
// gesture (RFC-028 Decision #6) so its sub-requests' envelopes don't each fire a
// toast — the gesture shows its own single summary instead.
let toastSuppressDepth = 0;

/**
 * Run `fn` with the central action-toast suppressed. Use for a UI gesture that
 * fans out to multiple mutations, or reuses a generic endpoint whose message is
 * wrong-grained for the gesture (e.g. property add/remove, edge reverse, canvas
 * erase). The caller is responsible for any summary toast of its own.
 */
export async function suppressActionToast<T>(fn: () => Promise<T>): Promise<T> {
	toastSuppressDepth++;
	try {
		return await fn();
	} finally {
		toastSuppressDepth--;
	}
}

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

// Telemetry (RFC-025 / RFC-026): trace the outgoing request and inject W3C
// trace-context so the engine's request span nests under it. We propagate
// explicitly here rather than rely on auto-XHR instrumentation, whose ambient
// context is lost crossing TanStack Query's async hops under Vite's native
// async/await (RFC-025 D3).
//
// Two cases produce a span: (a) an Explorer run is in flight → nests under
// `explorer.query.run`; (b) the request targets a session/message endpoint →
// its own one-span distributed trace, even outside a run (RFC-026 D3). All
// other API calls stay untraced.
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
	const method = (config.method ?? "get").toUpperCase();
	// Message ops live under `…/sessions/{id}/messages…`, so `/sessions` matches
	// both. Other routes (graphs, llm, events, …) stay untraced outside a run.
	const standalone = (config.url ?? "").includes("/sessions");
	const client = startClientSpan(
		`HTTP ${method}`,
		{
			"http.request.method": method,
			"url.full": `${config.baseURL ?? ""}${config.url ?? ""}`,
		},
		{ standalone },
	);
	if (client) {
		propagation.inject(client.ctx, config.headers, {
			set: (carrier, key, value) => carrier.set(key, value),
		});
		(config as TracedConfig)._otelSpan = client.span;
	}
	return config;
});

/** End the request's telemetry span (if any), stamping the HTTP status. */
function endRequestSpan(
	config: TracedConfig | undefined,
	status?: number,
): void {
	const span = config?._otelSpan;
	if (!span) return;
	if (status) span.setAttribute("http.response.status_code", status);
	if (!status || status >= 400) span.setStatus({ code: SpanStatusCode.ERROR });
	span.end();
	config._otelSpan = undefined; // a 401 retry re-runs the interceptor → fresh span
}

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

/**
 * Normalize FastAPI's error body into a human-readable string for the toast.
 *
 * - 422 returns `{ detail: [{type, loc, msg, input}, ...] }` — join the msgs +
 *   pretty-print the loc so the user sees something like:
 *     `path.graphSlug — Field required`
 * - Other errors return `{ detail: "..." }` — pass through.
 * - Anything else falls back to `error.message`.
 */
function formatErrorDetail(error: AxiosError): string {
	const detail = (error.response?.data as { detail?: unknown } | undefined)
		?.detail;
	if (typeof detail === "string") return detail;
	if (Array.isArray(detail)) {
		return detail
			.map((d) => {
				const item = d as { msg?: string; loc?: unknown[] };
				const loc = Array.isArray(item.loc)
					? item.loc.filter((p) => p !== "body" && p !== "path").join(".")
					: "";
				return loc
					? `${loc} — ${item.msg ?? "invalid"}`
					: (item.msg ?? "invalid");
			})
			.join("; ");
	}
	return error.message;
}

apiClient.interceptors.response.use(
	(res) => {
		endRequestSpan(res.config as TracedConfig, res.status);
		// RFC-028: the backend owns the toast copy. Any mutation (non-GET) that
		// returns an `ActionResponse` envelope is toasted here, centrally, so call
		// sites never hardcode a success string. Suppressed inside a multi-request
		// gesture (see `suppressActionToast`).
		const method = (res.config.method ?? "get").toLowerCase();
		if (
			method !== "get" &&
			toastSuppressDepth === 0 &&
			isActionEnvelope(res.data)
		) {
			toast.success(res.data.message);
		}
		return res;
	},
	async (error: AxiosError) => {
		const config = error.config as
			| (InternalAxiosRequestConfig & { _retried?: boolean })
			| undefined;
		const status = error.response?.status;
		endRequestSpan(config as TracedConfig | undefined, status);
		const isAuthPath = config?.url?.includes("/api/v1/auth/");

		if (status === 401 && config && !config._retried && !isAuthPath) {
			const newToken = await attemptRefresh();
			if (newToken) {
				config._retried = true;
				config.headers.set("Authorization", `Bearer ${newToken}`);
				return apiClient.request(config);
			}
		}

		throw new ApiError(status ?? 0, formatErrorDetail(error));
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
	const res = await apiClient.request(config);
	if (res.status === 204) return undefined as T;
	// RFC-028: unwrap the `{ message, data }` mutation envelope so callers receive
	// the resource (or `undefined` for a delete) exactly as before; the message was
	// already toasted by the response interceptor.
	if (isActionEnvelope(res.data)) return res.data.data as T;
	return res.data as T;
}
