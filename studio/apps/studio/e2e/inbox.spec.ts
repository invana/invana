import { expect, type Page, test } from "@playwright/test";
import { graphApi, me } from "./api";
import { GRAPH } from "./explorer";

/**
 * Activity › Inbox: what needs a person on a Graph. A notification arrives
 * through a rule the spec writes, so a stack with only `demos/airways` loaded
 * passes and no LLM run is needed — creating a schedule is the event.
 */

interface InboxRead {
	items: { id: string; rule_id: string | null; target_id: string | null }[];
	unread: number;
}

/** The row of an Inbox item, by its title. */
function row(page: Page, title: string) {
	return page.locator('[data-slot="item"]').filter({ hasText: title });
}

test("a rule's notification reaches the Inbox, opens its schedule and reads as read", async ({
	page,
}) => {
	// The engine's clock matches new events against rules every ~30 s.
	test.setTimeout(240_000);
	const stamp = Date.now();
	const rule = await graphApi<{ id: string; name: string }>(
		page,
		"/notifications/rules",
		{
			method: "POST",
			data: {
				name: `e2e inbox ${stamp}`,
				events: ["schedule.create"],
				members: [me()],
				in_app: true,
			},
		},
	);
	let scheduleId: string | null = null;
	try {
		const agents = await graphApi<{
			items: { id: string }[];
			default_agent_id: string | null;
		}>(page, "/agents");
		const agent = agents.default_agent_id ?? agents.items[0]?.id;
		test.skip(!agent, "the Graph has no agent");
		// The notice's body names the schedule, which tells this row apart from
		// one the rule writes for a schedule another spec makes meanwhile.
		const name = `e2e inbox schedule ${stamp}`;
		const schedule = await graphApi<{ id: string }>(page, "/schedules", {
			method: "POST",
			data: {
				name,
				agent,
				instructions: "List the five busiest airports.",
				cron: "0 7 * * *",
				// A schedule must deliver somewhere; it never fires during the test.
				deliver_in_app: true,
			},
		});
		scheduleId = schedule.id;

		await expect
			.poll(
				async () => {
					const inbox = await graphApi<InboxRead>(page, "/notifications");
					return inbox.items.some(
						(n) => n.rule_id === rule.id && n.target_id === schedule.id,
					);
				},
				// A loaded stack can miss a tick or two.
				{ timeout: 150_000, intervals: [3_000] },
			)
			.toBe(true);

		await page.goto(`${GRAPH}/activity/inbox`);
		const mine = row(page, rule.name).filter({ hasText: name });
		await expect(mine.getByRole("img", { name: "Unread" })).toBeVisible({
			timeout: 30_000,
		});
		await mine.getByRole("button", { name: "Open", exact: true }).click();
		await expect(page).toHaveURL(
			`${GRAPH}/activity/schedules/${encodeURIComponent(schedule.id)}`,
		);

		await page.goto(`${GRAPH}/activity/inbox`);
		await expect(mine).toBeVisible({ timeout: 30_000 });
		await expect(mine.getByRole("img", { name: "Unread" })).toHaveCount(0);

		// Every row this rule wrote, read or not, reads as read after Mark all read.
		const markAll = page.getByRole("button", { name: "Mark all read" });
		if (await markAll.isEnabled()) await markAll.click();
		await expect(
			row(page, rule.name).getByRole("img", { name: "Unread" }),
		).toHaveCount(0, { timeout: 30_000 });
	} finally {
		if (scheduleId)
			await graphApi(page, `/schedules/${scheduleId}`, { method: "DELETE" });
		await graphApi(page, `/notifications/rules/${rule.id}`, {
			method: "DELETE",
		});
	}
});

test("the bell and the Inbox tab carry one count", async ({ page }) => {
	await page.goto(`${GRAPH}/activity/inbox`);
	const bell = page.getByRole("link", { name: "Notifications" });
	const tab = page.getByRole("tab", { name: /^Inbox/ });
	await expect(tab).toBeVisible({ timeout: 30_000 });
	// Both read one query; poll so a refetch landing between reads cannot split them.
	await expect
		.poll(
			async () => {
				const b = (await bell.innerText()).match(/(\d+)\s*$/)?.[1] ?? "0";
				const t = (await tab.innerText()).match(/·\s*(\d+)/)?.[1] ?? "0";
				return b === t;
			},
			{ timeout: 30_000 },
		)
		.toBe(true);
});
