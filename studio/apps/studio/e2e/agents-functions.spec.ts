/**
 * Agents › Functions and Connections — the catalogue grouped by namespace, a
 * function opening as a tab of its own, and the MCP servers with their Add
 * modal. Reads only: the modal is opened and cancelled.
 */
import { expect, test } from "@playwright/test";

const GRAPH = process.env.E2E_GRAPH_PATH ?? "/u/admin/airways";

test("Functions groups the catalogue by namespace and opens a function", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/agents/functions`);
	await expect(page.getByRole("cell", { name: "graph.read.*" })).toBeVisible({
		timeout: 30_000,
	});

	const row = page.getByRole("row", { name: /^graph\.read\.\w+/ }).first();
	const key = (await row.getByRole("cell").first().textContent()) ?? "";
	await row.click();
	await expect(page.getByRole("tab", { name: key })).toHaveAttribute(
		"aria-selected",
		"true",
		{ timeout: 20_000 },
	);
});

test("a bound filter narrows the catalogue on the engine", async ({ page }) => {
	await page.goto(`${GRAPH}/agents/functions?f.bound=llm`);
	await expect(page.getByRole("row", { name: /^nl\.\w+/ }).first()).toBeVisible(
		{ timeout: 30_000 },
	);
	await expect(page.getByRole("cell", { name: "graph.read.*" })).toHaveCount(0);
});

test("Connections lists MCP servers or says none, and opens Add MCP server", async ({
	page,
}) => {
	await page.goto(`${GRAPH}/agents/connections/mcp`);
	await expect(
		page
			.getByText("No MCP servers")
			.or(
				page.getByRole("columnheader", { name: "Credential on the workers" }),
			),
	).toBeVisible({ timeout: 30_000 });

	const add = page.getByRole("button", { name: "Add MCP server" }).first();
	test.skip(await add.isDisabled(), "Adding is an install Admin's act");
	await add.click();
	const dialog = page.getByRole("dialog", { name: "Add an MCP server" });
	await expect(dialog).toBeVisible();
	await dialog.getByLabel("Name").fill("figma");
	await expect(dialog.getByLabel("Credential")).toHaveValue(
		"INVANA_SECRET_MCP_FIGMA",
	);
	await dialog.getByRole("button", { name: "Cancel" }).click();
	await expect(dialog).toHaveCount(0);
});
