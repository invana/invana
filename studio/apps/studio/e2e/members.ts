import { readFileSync } from "node:fs";
import {
	type Browser,
	type BrowserContext,
	expect,
	type Page,
	test,
} from "@playwright/test";
import { GRAPH } from "./explorer";

/**
 * A second person on the Graph, with the roles a spec needs.
 *
 * The signed-in admin provisions the account (`POST /auth/register` is the
 * install Admin's) and sets its Graph roles; the spec then opens Studio in a
 * fresh browser context signed in as that person. Every call converges — an
 * account or membership an earlier run made is reused, its roles reset.
 *
 *     await memberWithRoles(page, "e2e-viewer", ["viewer"]);
 *     const { page: viewer, close } = await signInAs(browser, "e2e-viewer");
 */

const API = process.env.E2E_API_URL ?? "http://localhost:8200";
const PASSWORD = "e2e-member-password-1";

function adminToken(): string {
	const path = test.info().project.use.storageState as string;
	const state = JSON.parse(readFileSync(path, "utf8"));
	const auth = state.origins
		.flatMap(
			(o: { localStorage: { name: string; value: string }[] }) =>
				o.localStorage,
		)
		.find((i: { name: string }) => i.name === "invana.auth");
	return JSON.parse(auth.value).state.accessToken;
}

type Role = "viewer" | "contributor" | "builder" | "modeller" | "owner";

/** An account for `username` — made by the admin, or found from an earlier run. */
export async function ensureAccount(page: Page, username: string) {
	const made = await page.request.post(`${API}/api/v1/auth/register`, {
		headers: { Authorization: `Bearer ${adminToken()}` },
		data: {
			email: `${username}@example.com`,
			first_name: username,
			username,
			password: PASSWORD,
		},
	});
	expect([201, 409], `register ${username} → ${made.status()}`).toContain(
		made.status(),
	);
}

/** Make `username` a member of the e2e Graph holding exactly `roles`. */
export async function memberWithRoles(
	page: Page,
	username: string,
	roles: Role[],
): Promise<{ user_id: string; username: string }> {
	await ensureAccount(page, username);
	const headers = { Authorization: `Bearer ${adminToken()}` };
	const base = `${API}/api/v1${GRAPH}/members`;
	const added = await page.request.post(base, {
		headers,
		data: { user: username, roles },
	});
	if (added.ok()) return added.json();
	expect(added.status(), `add ${username} → ${added.status()}`).toBe(409);
	const set = await page.request.patch(`${base}/${username}`, {
		headers,
		data: { roles },
	});
	expect(set.ok(), `set roles of ${username} → ${set.status()}`).toBe(true);
	return set.json();
}

/** Take `username` off the e2e Graph, if they are on it. */
export async function removeMember(page: Page, username: string) {
	await page.request.delete(`${API}/api/v1${GRAPH}/members/${username}`, {
		headers: { Authorization: `Bearer ${adminToken()}` },
	});
}

/** Studio in its own browser context, signed in as `username`. */
export async function signInAs(
	browser: Browser,
	username: string,
): Promise<{
	page: Page;
	context: BrowserContext;
	close: () => Promise<void>;
}> {
	const context = await browser.newContext({
		storageState: { cookies: [], origins: [] },
	});
	const page = await context.newPage();
	await page.goto("/login");
	await page.getByLabel("Email or username").fill(username);
	await page.getByLabel("Password").fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page).toHaveURL(/\/(graphs)?(\?.*)?$/);
	await page.evaluate(() =>
		localStorage.setItem("explorer.session.tutorial.seen", "true"),
	);
	return { page, context, close: () => context.close() };
}
