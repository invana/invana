/**
 * Agents › Connections › This Graph's server — the landing tab: the endpoint,
 * the `claude mcp add` line, what it serves with a switch each, and recent
 * calls. A switch flipped is flipped back, so the Graph is left as found.
 */
import { expect, test } from "@playwright/test";

const GRAPH = process.env.E2E_GRAPH_PATH ?? "/u/admin/airways";

test("Connections lands on This Graph's server and a Served switch round-trips", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/agents/connections`);
	await expect(page).toHaveURL(/\/agents\/connections\/server/, {
		timeout: 30_000,
	});
	await expect(page.getByText("claude mcp add")).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("Streamable HTTP")).toBeVisible();

	const serve = page.getByRole("switch", { name: "Serve validate_records" });
	await expect(serve).toBeVisible();
	test.skip(await serve.isDisabled(), "Serving is the build area's act");
	const was = (await serve.getAttribute("aria-checked")) === "true";
	await serve.click();
	await expect(serve).toHaveAttribute("aria-checked", String(!was));
	await serve.click();
	await expect(serve).toHaveAttribute("aria-checked", String(was));
});

test("the MCP servers tab keeps the outside servers", async ({ page }) => {
	await page.goto(`${GRAPH}/agents/connections/server`);
	await page.getByRole("tab", { name: "MCP servers" }).click();
	await expect(page).toHaveURL(/\/agents\/connections\/mcp/);
	await expect(
		page
			.getByText("No MCP servers")
			.or(
				page.getByRole("columnheader", { name: "Credential on the workers" }),
			),
	).toBeVisible({ timeout: 30_000 });
});
