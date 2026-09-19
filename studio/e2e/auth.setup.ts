import { expect, test as setup } from "@playwright/test";

/**
 * Sign in once and keep the session for every spec.
 *
 * Auth is a localStorage store (`invana.auth`, stores/auth.store.ts), so
 * Playwright's storageState carries it — no spec repeats the login.
 *
 * The credentials are the dev-only defaults `invana init` provisions (see the
 * Makefile's `engine-init` target). Point the run at a different account by
 * exporting E2E_USERNAME / E2E_PASSWORD; nothing here belongs anywhere but a
 * local stack.
 */

const USERNAME = process.env.E2E_USERNAME ?? "admin";
const PASSWORD = process.env.E2E_PASSWORD ?? "change_me_please";

setup("signs in", async ({ page }) => {
	await page.goto("/login");

	await page.getByLabel("Email or username").fill(USERNAME);
	await page.getByLabel("Password").fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();

	// The graphs list is the first screen behind the login.
	await expect(page).toHaveURL(/\/(graphs)?$/);

	// The Explorer's first-run tutorial is a modal over the thread, and it is
	// gated on this flag (components/SessionTutorialModal.tsx). Mark it seen here
	// so no spec has to dismiss a dialog it is not testing.
	await page.evaluate(() =>
		localStorage.setItem("explorer.session.tutorial.seen", "true"),
	);

	await page.context().storageState({ path: "e2e/.auth/user.json" });
});
