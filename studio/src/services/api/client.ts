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

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		headers: { "Content-Type": "application/json", ...init?.headers },
		...init,
	});

	if (res.status === 204) return undefined as T;

	if (!res.ok) {
		const text = await res.text().catch(() => res.statusText);
		let message: string;
		try {
			const json = JSON.parse(text) as { detail?: string };
			message = json.detail ?? text;
		} catch {
			message = text;
		}
		throw new ApiError(res.status, message);
	}

	return res.json() as Promise<T>;
}
