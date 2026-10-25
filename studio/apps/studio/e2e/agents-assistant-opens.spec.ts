/**
 * The assistant opens a list (the-assistant-opens-boards.md): the link a
 * `board.open` step writes is the list contract's own params plus
 * `via=assistant`, so it reloads to the same chips, and a filter the engine
 * could not resolve is simply absent while the others stay.
 *
 * Nothing calls a model: the spec opens the address the link card opens.
 * Needs `demos/airways`.
 */
import { expect, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

const RUNS = `${GRAPH}/agents/runs`;

test("a link the assistant wrote reloads to the same chips", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/agents/home`);
	const agents = await graphApi<{ items: { id: string; name: string }[] }>(
		page,
		"/agents",
	);
	const agent = agents.items[0];
	expect(agent).toBeTruthy();

	await page.goto(
		`${RUNS}?f.agent_id=${agent.id}&f.status=failed&f.since=30d&via=assistant`,
	);
	const strip = page.getByRole("group", { name: "Applied filters" });
	const chips = strip.getByRole("button", { name: /^Remove / });
	await expect(chips).toHaveCount(3, { timeout: 30_000 });
	await expect(strip.getByText(agent.name)).toBeVisible();
	await expect(strip.getByText("set by the assistant")).toBeVisible();

	await page.reload();
	await expect(chips).toHaveCount(3, { timeout: 30_000 });
	await expect(strip.getByText(agent.name)).toBeVisible();
	await expect(strip.getByText("set by the assistant")).toBeVisible();
});

test("an agent name that did not resolve keeps the other filters", async ({
	page,
}) => {
	// What `board.open` links when "Route Auditer" names no agent: the
	// status and window it did resolve, and no agent filter.
	await page.goto(`${RUNS}?f.status=failed&f.since=30d&via=assistant`);
	const strip = page.getByRole("group", { name: "Applied filters" });
	await expect(strip.getByRole("button", { name: /^Remove / })).toHaveCount(2, {
		timeout: 30_000,
	});
	await expect(
		strip.getByRole("button", { name: /^Remove agent/ }),
	).toHaveCount(0);
	await expect(page).toHaveURL(/f\.status=failed/);
	await expect(page).toHaveURL(/f\.since=30d/);
});
