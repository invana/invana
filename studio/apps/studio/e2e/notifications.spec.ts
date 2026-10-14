import { expect, type Page, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

/**
 * Activity › Rules and Activity › Channels: who hears about which events,
 * and where it is sent. Every rule and channel here is made by the spec,
 * named for this run, and removed in `finally`.
 */

interface Rule {
	id: string;
	name: string;
	enabled: boolean;
}

async function rulesNamed(page: Page, name: string): Promise<Rule[]> {
	const { items } = await graphApi<{ items: Rule[] }>(
		page,
		"/notifications/rules",
	);
	return items.filter((r) => r.name === name);
}

async function dropRules(page: Page, name: string) {
	for (const r of await rulesNamed(page, name))
		await graphApi(page, `/notifications/rules/${r.id}`, { method: "DELETE" });
}

test("a rule lists with its events, and its switch disables it", async ({
	page,
}) => {
	const name = `e2e rule ${Date.now()}`;
	const rule = await graphApi<Rule>(page, "/notifications/rules", {
		method: "POST",
		data: {
			name,
			events: ["run.finish"],
			match: { status: "failed" },
			requester: true,
		},
	});
	try {
		await page.goto(`${GRAPH}/activity/rules`);
		await expect(page.getByText(name)).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText("has status failed").first()).toBeVisible();
		const toggle = page.getByRole("switch", { name: `${name} enabled` });
		await expect(toggle).toBeChecked();
		await toggle.click();
		await expect(toggle).not.toBeChecked();
		await expect
			.poll(async () => (await rulesNamed(page, name))[0]?.enabled)
			.toBe(false);
	} finally {
		await graphApi(page, `/notifications/rules/${rule.id}`, {
			method: "DELETE",
		});
	}
});

test("New rule with Any run fails saves and lists", async ({ page }) => {
	const name = `e2e any run fails ${Date.now()}`;
	try {
		await page.goto(`${GRAPH}/activity/rules?new=1`);
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("New rule")).toBeVisible({
			timeout: 30_000,
		});
		await dialog.getByRole("button", { name: "Any run fails" }).click();
		await dialog.getByLabel("Name", { exact: true }).fill(name);
		await expect(dialog.getByText("run.finish")).toBeVisible();
		await dialog.getByRole("button", { name: "Save rule" }).click();
		await expect(dialog).toHaveCount(0);
		await expect(page).toHaveURL(`${GRAPH}/activity/rules`);
		await expect(page.getByText(name)).toBeVisible();
		const [saved] = await rulesNamed(page, name);
		expect(saved).toBeTruthy();
	} finally {
		await dropRules(page, name);
	}
});

test("a channel in use cannot be removed until its rule is gone", async ({
	page,
}) => {
	const stamp = Date.now();
	const channelName = `e2e hook ${stamp}`;
	const ruleName = `e2e hook rule ${stamp}`;
	const channel = await graphApi<{ id: string }>(
		page,
		"/notifications/channels",
		{
			method: "POST",
			data: {
				name: channelName,
				kind: "webhook",
				target: "https://example.org/hook/secret-path",
			},
		},
	);
	let ruleId: string | null = (
		await graphApi<Rule>(page, "/notifications/rules", {
			method: "POST",
			data: {
				name: ruleName,
				events: ["run.finish"],
				requester: true,
				channels: [channel.id],
			},
		})
	).id;
	try {
		await page.goto(`${GRAPH}/activity/channels`);
		await expect(page.getByText("In app", { exact: true })).toBeVisible({
			timeout: 30_000,
		});
		const row = page
			.locator('[data-slot="item"]')
			.filter({ hasText: channelName });
		await expect(row).toBeVisible();
		await expect(row.getByText(/^Webhook · /)).toBeVisible();
		await expect(row.getByText(/secret-path/)).toHaveCount(0);
		await expect(page.getByText("Microsoft Teams")).toBeVisible();

		const remove = page.getByRole("button", { name: `Remove ${channelName}` });
		await remove.click();
		await page.getByRole("button", { name: "Remove", exact: true }).click();
		await expect(row.getByRole("alert")).toContainText(ruleName);

		await graphApi(page, `/notifications/rules/${ruleId}`, {
			method: "DELETE",
		});
		ruleId = null;
		await remove.click();
		await page.getByRole("button", { name: "Remove", exact: true }).click();
		await expect(row).toHaveCount(0);
	} finally {
		if (ruleId)
			await graphApi(page, `/notifications/rules/${ruleId}`, {
				method: "DELETE",
			});
		const { items } = await graphApi<{ items: { id: string; name: string }[] }>(
			page,
			"/notifications/channels",
		);
		for (const c of items.filter((x) => x.name === channelName))
			await graphApi(page, `/notifications/channels/${c.id}`, {
				method: "DELETE",
			});
	}
});
