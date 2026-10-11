import { expect, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

/**
 * Projects is its own product: its rail is the shell's `leftNav`, a project
 * sits right under the product's root, a todo under My todos, and Decisions
 * shows its lock until the engine records decisions.
 *
 * The project and the todo are made here and removed after. Needs
 * `demos/airways`.
 */

const PROJECTS = `${GRAPH}/projects`;

test("the product lands on Projects with its own rail", async ({ page }) => {
	await page.goto(PROJECTS);
	for (const item of ["Projects", "My todos", "Decisions"]) {
		await expect(page.locator(`button[aria-label="${item}"]`)).toBeVisible({
			timeout: 30_000,
		});
	}
	await page.locator('button[aria-label="Decisions"]').click();
	await expect(page).toHaveURL(new RegExp(`${PROJECTS}/decisions(\\?|$)`));
	await expect(
		page.getByText("Opens with engine support", { exact: true }),
	).toBeVisible({ timeout: 30_000 });
});

test("a project and a todo open at their paths", async ({ page }) => {
	const stamp = Date.now();
	const name = `E2E project ${stamp}`;
	const project = await graphApi<{ key: string }>(page, "/projects", {
		method: "POST",
		data: { name, key: `e2e-${stamp}` },
	});
	const title = `E2E todo ${stamp}`;
	const todo = await graphApi<{ id: string }>(page, "/tasks", {
		method: "POST",
		data: { title, project_key: project.key },
	});

	try {
		await page.goto(`${PROJECTS}/${project.key}`);
		await expect(page.getByText(name).first()).toBeVisible({
			timeout: 30_000,
		});

		// The todo is drilled into on My todos; its title is drawn on the plan
		// canvas, so the section's trail is what the DOM reads.
		await page.goto(`${PROJECTS}/todos/${todo.id}`);
		await expect(
			page.getByRole("button", { name: "Back to Todos" }),
		).toBeVisible({ timeout: 30_000 });
		await expect(page.locator('button[aria-label="My todos"]')).toBeVisible();
	} finally {
		await graphApi(page, `/tasks/${todo.id}`, { method: "DELETE" });
		// This run's project, and any an earlier, interrupted run left behind.
		const { items } = await graphApi<{
			items: { key: string; name: string }[];
		}>(page, "/projects");
		for (const p of items.filter((i) => i.name.startsWith("E2E project ")))
			await graphApi(page, `/projects/${p.key}`, { method: "DELETE" });
	}
});
