/**
 * Activity › Schedules — the list and Coming up, New schedule, a schedule's
 * page and a refusal (SH-13).
 *
 * Each test makes its own `e2e-sched-` schedule — through the engine's API or
 * the dialog — and deletes it in `finally`. *Run now* is checked as queued
 * only: nothing here waits on a model's run.
 */
import { expect, type Page, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

interface Agent {
	id: string;
	name: string;
}

async function anAgent(page: Page): Promise<Agent> {
	const res = await graphApi<{ items: Agent[] } | Agent[]>(page, "/agents");
	const items = Array.isArray(res) ? res : res.items;
	expect(items.length, "the Graph has an agent").toBeGreaterThan(0);
	return items[0];
}

/** Deletes a schedule this test made, if it is still there. */
async function cleanUp(page: Page, id: string | null) {
	if (!id) return;
	await graphApi(page, `/schedules/${id}`, { method: "DELETE" }).catch(
		() => undefined,
	);
}

test("a schedule shows in Coming up and in the list", async ({ page }) => {
	const agent = await anAgent(page);
	const name = `e2e-sched-${Date.now()}`;
	const made = await graphApi<{ id: string }>(page, "/schedules", {
		method: "POST",
		data: {
			name,
			agent: agent.id,
			instructions: "Count the airports.",
			cron: "0 7 * * *",
			deliver_in_app: true,
		},
	});
	try {
		await page.goto(`${GRAPH}/activity/schedules`);
		const comingUp = page.getByRole("table", { name: "Coming up" });
		const row = comingUp.getByRole("row").filter({ hasText: name });
		await expect(row).toContainText(`${name} · Daily 07:00`, {
			timeout: 30_000,
		});
		// Daily: a dot on each of the seven days.
		await expect(row.getByRole("img")).toHaveCount(7);
		await expect(
			page.getByText(new RegExp(`^Daily 07:00 · ${agent.name} · In app`)),
		).toBeVisible();
		await page.getByRole("button", { name: `Open ${name}` }).click();
		await expect(page).toHaveURL(`${GRAPH}/activity/schedules/${made.id}`);
		await expect(page.getByText("Count the airports.")).toBeVisible();
	} finally {
		await cleanUp(page, made.id);
	}
});

test("New schedule creates one, and its page runs, pauses and deletes it", async ({
	page,
}) => {
	const name = `e2e-sched-${Date.now()}`;
	let id: string | null = null;
	try {
		await page.goto(`${GRAPH}/activity/schedules`);
		await page
			.getByRole("button", { name: "New schedule" })
			.click({ timeout: 30_000 });
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("Name", { exact: true }).fill(name);
		await dialog.getByLabel("What to do").fill("Count the airports.");
		await dialog.getByRole("radio", { name: "Weekdays" }).click();
		const created = page.waitForResponse(
			(r) => r.request().method() === "POST" && /\/schedules$/.test(r.url()),
		);
		await dialog.getByRole("button", { name: "Create schedule" }).click();
		id = ((await (await created).json()) as { id: string }).id;

		await expect(page).toHaveURL(`${GRAPH}/activity/schedules/${id}`);
		await expect(
			page.getByLabel("Breadcrumb").getByText(name, { exact: true }),
		).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText("Weekdays 08:00")).toBeVisible();

		await page.getByRole("button", { name: "Run now" }).click();
		await expect(
			page.getByText("Queued — the run opens within a minute."),
		).toBeVisible();

		await page.getByRole("button", { name: "Pause" }).click();
		await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
		await expect(page.getByText("paused", { exact: true })).toBeVisible();

		await page.getByRole("button", { name: "Delete" }).click();
		await page
			.getByRole("alertdialog")
			.getByRole("button", { name: "Delete" })
			.click();
		await expect(page).toHaveURL(`${GRAPH}/activity/schedules`);
		id = null;
	} finally {
		await cleanUp(page, id);
	}
});

test("a bad cron is refused with the engine's reason", async ({ page }) => {
	await page.goto(`${GRAPH}/activity/schedules`);
	await page
		.getByRole("button", { name: "New schedule" })
		.click({ timeout: 30_000 });
	const dialog = page.getByRole("dialog");
	await dialog
		.getByLabel("Name", { exact: true })
		.fill(`e2e-sched-${Date.now()}`);
	await dialog.getByLabel("What to do").fill("Count the airports.");
	await dialog.getByRole("radio", { name: "Custom" }).click();
	await dialog.getByLabel("Cron").fill("61 8 * * *");
	await dialog.getByRole("button", { name: "Create schedule" }).click();
	await expect(dialog.getByRole("alert")).toContainText("minute");
	await expect(page).toHaveURL(`${GRAPH}/activity/schedules`);
});
