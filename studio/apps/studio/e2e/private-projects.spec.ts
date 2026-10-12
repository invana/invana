import { expect, type Page, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";
import { memberWithRoles, signInAs } from "./members";

/**
 * A private project is the people on it: New project offers the Graph's other
 * members by name, the project's header reads *people only:* and their names,
 * and a member who is not on it finds it neither in the Projects list nor in
 * ⌘K — the lists ⌘K reads are already filtered by the engine. A viewer reads
 * *New project* disabled.
 *
 * One stamp names two projects: the private one made through *New project*,
 * and a Graph-visible one made through the API. Searching the stamp proves the
 * list has loaded (the visible one shows) before asserting the private one
 * does not. Both are deleted after.
 */

const PROJECTS = `${GRAPH}/projects`;
const stamp = Date.now();
const PRIVATE = `e2e-private-${stamp}`;
const VISIBLE = `e2e-visible-${stamp}`;

test.describe.configure({ mode: "serial" });

/** ⌘K with `query` typed, on the Projects product. */
async function palette(page: Page, query: string) {
	await page.goto(PROJECTS);
	await expect(page.getByRole("button", { name: /Search or ask/ })).toBeVisible(
		{ timeout: 30_000 },
	);
	await page.keyboard.press("ControlOrMeta+k");
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("combobox").fill(query);
	return dialog;
}

test("New project staffs a picked member, and a private project names its people", async ({
	page,
}) => {
	await memberWithRoles(page, "e2e-colleague", ["contributor"]);
	await memberWithRoles(page, "e2e-outsider", ["viewer"]);
	await graphApi(page, "/projects", {
		method: "POST",
		data: { name: VISIBLE, type: "research", question: "Visible to all?" },
	});

	await page.goto(PROJECTS);
	await page
		.getByRole("button", { name: "New project" })
		.click({ timeout: 30_000 });
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("The question").fill("Who may see this?");
	await dialog.getByLabel("Name", { exact: true }).fill(PRIVATE);
	await dialog.getByRole("checkbox", { name: "e2e-colleague" }).click();
	await dialog.getByRole("radio", { name: "Only the people on it" }).click();
	await dialog.getByRole("button", { name: "Create project" }).click();
	await expect(dialog).toBeHidden({ timeout: 30_000 });

	await expect(
		page.getByRole("main").getByText(/^people only: .*e2e-colleague/),
	).toBeVisible({ timeout: 30_000 });
});

test("only the people on a private project find it; a viewer cannot start one", async ({
	page,
	browser,
}) => {
	try {
		const outsider = await signInAs(browser, "e2e-outsider");
		try {
			const out = outsider.page;
			await out.goto(PROJECTS);
			await expect(out.getByText(VISIBLE).first()).toBeVisible({
				timeout: 30_000,
			});
			await expect(out.getByText(PRIVATE)).toHaveCount(0);
			await expect(
				out.getByRole("button", { name: "New project" }),
			).toBeDisabled();

			const search = await palette(out, `${stamp}`);
			await expect(
				search.getByRole("option", { name: new RegExp(VISIBLE) }),
			).toBeVisible({ timeout: 30_000 });
			await expect(
				search.getByRole("option", { name: new RegExp(PRIVATE) }),
			).toHaveCount(0);
		} finally {
			await outsider.close();
		}

		const colleague = await signInAs(browser, "e2e-colleague");
		try {
			const search = await palette(colleague.page, PRIVATE);
			await expect(
				search.getByRole("option", { name: new RegExp(PRIVATE) }),
			).toBeVisible({ timeout: 30_000 });
		} finally {
			await colleague.close();
		}
	} finally {
		const { items } = await graphApi<{
			items: { key: string; name: string }[];
		}>(page, "/projects");
		for (const p of items.filter(
			(i) => i.name === PRIVATE || i.name === VISIBLE,
		))
			await graphApi(page, `/projects/${p.key}`, { method: "DELETE" });
	}
});
