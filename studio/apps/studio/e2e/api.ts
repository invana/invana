import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { ask, GRAPH } from "./explorer";

/**
 * The records a spec needs, made by the spec.
 *
 * A spec that opens a run, a rule or a report creates it here — through the
 * engine's API or by driving Studio — so a stack with only `demos/airways`
 * loaded passes. Nothing reads a row somebody made by hand.
 *
 * The token is the one `auth.setup.ts` signed in with, read from the project's
 * `storageState`; it is the same session every page in the run carries.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:8200";

function authState(): { accessToken: string; user: { id: string } } {
	const path = test.info().project.use.storageState as string;
	const state = JSON.parse(readFileSync(path, "utf8"));
	const auth = state.origins
		.flatMap(
			(o: { localStorage: { name: string; value: string }[] }) =>
				o.localStorage,
		)
		.find((i: { name: string }) => i.name === "invana.auth");
	return JSON.parse(auth.value).state;
}

function token(): string {
	return authState().accessToken;
}

/** The signed-in user's id — what *My todos* filters its assignee by. */
export function me(): string {
	return authState().user.id;
}

/** Call a Graph-scoped route (`/rules`, `/skills`, …) as the signed-in user. */
export async function graphApi<T>(
	page: Page,
	path: string,
	init: {
		method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
		data?: unknown;
	} = {},
): Promise<T> {
	const res = await page.request.fetch(`${API}/api/v1${GRAPH}${path}`, {
		method: init.method ?? "GET",
		data: init.data,
		headers: { Authorization: `Bearer ${token()}` },
	});
	expect(res.ok(), `${init.method ?? "GET"} ${path} → ${res.status()}`).toBe(
		true,
	);
	return res.status() === 204 ? (undefined as T) : res.json();
}

/** The status a Graph-scoped GET answers with — for polling until a record reads back. */
export async function graphStatus(page: Page, path: string): Promise<number> {
	const res = await page.request.get(`${API}/api/v1${GRAPH}${path}`, {
		headers: { Authorization: `Bearer ${token()}` },
	});
	return res.status();
}

/**
 * Call an install-wide route (`/datasets`, `/standards`) as the signed-in
 * user. `accept` names the refusals the caller expects on a re-run — `409`
 * for a record an earlier run already made — and they answer `null`.
 */
export async function api<T>(
	page: Page,
	path: string,
	init: {
		method?: "GET" | "POST" | "PATCH" | "DELETE";
		data?: unknown;
		accept?: number[];
	} = {},
): Promise<T | null> {
	const res = await page.request.fetch(`${API}/api/v1${path}`, {
		method: init.method ?? "GET",
		data: init.data,
		headers: { Authorization: `Bearer ${token()}` },
	});
	if (init.accept?.includes(res.status())) return null;
	expect(res.ok(), `${init.method ?? "GET"} ${path} → ${res.status()}`).toBe(
		true,
	);
	return res.status() === 204 ? null : res.json();
}

/**
 * A Graph invariant with this statement — found, or written once.
 *
 * Rules are never deleted, and an active one is offered to every prompt, so a
 * rule this makes is deactivated straight away: the spec needs the record, not
 * a statement steering every later ask.
 */
export async function ruleWithStatement(
	page: Page,
	statement: string,
): Promise<string> {
	const { items } = await graphApi<{
		items: { id: string; statement: string }[];
	}>(page, "/rules");
	const found = items.find((r) => r.statement === statement);
	if (found) return found.id;
	const rule = await graphApi<{ id: string }>(page, "/rules", {
		method: "POST",
		data: { statement },
	});
	await graphApi(page, `/rules/${rule.id}/deactivate`, { method: "POST" });
	return rule.id;
}

/** A skill every Graph is seeded with, by name. */
export async function skillNamed(page: Page, name: string): Promise<string> {
	const { items } = await graphApi<{ items: { id: string; name: string }[] }>(
		page,
		"/skills",
	);
	const skill = items.find((s) => s.name === name);
	expect(skill, `skill "${name}"`).toBeTruthy();
	return (skill as { id: string }).id;
}

/** Ask a query in the Explorer and answer with the run it opened. */
export async function askForRun(page: Page, query: string): Promise<string> {
	const sent = page.waitForResponse(
		(r) =>
			r.request().method() === "POST" &&
			/\/sessions\/[^/]+\/messages$/.test(r.url()),
		{ timeout: 30_000 },
	);
	await ask(page, query);
	const { run_id } = await (await sent).json();
	expect(run_id, "the ask opened a run").toBeTruthy();
	return run_id as string;
}
