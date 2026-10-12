import { expect, test } from "@playwright/test";
import { openExplorer } from "./explorer";

/**
 * Sharing an answer: *Share* on a settled reply opens the dialog, a frozen
 * snapshot is kept as a report on the run and its link copied, and the answer
 * exports as a Markdown file. Needs `demos/airways`.
 */

test("EX-15 an answer is shared as a frozen snapshot and exported", async ({
	page,
	context,
}) => {
	// An ask runs the whole pipeline, which is slower than a read.
	test.setTimeout(120_000);
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);

	const composer = await openExplorer(page);
	await composer.fill("MATCH (n) RETURN n LIMIT 1");
	await page.getByRole("button", { name: "Send" }).click();
	await page
		.getByRole("button", { name: "Share", exact: true })
		.last()
		.click({ timeout: 60_000 });

	const dialog = page.getByRole("dialog", { name: "Share this answer" });
	await expect(dialog).toBeVisible();

	const markdown = dialog.getByRole("button", { name: "Markdown" });
	await expect(markdown).toBeEnabled({ timeout: 30_000 });
	const [file] = await Promise.all([
		page.waitForEvent("download"),
		markdown.click(),
	]);
	expect(file.suggestedFilename()).toMatch(/\.md$/);

	await dialog.getByRole("radio", { name: "Frozen snapshot" }).click();
	await expect(
		dialog.getByText("dataset versions", { exact: true }),
	).toBeVisible();
	await dialog.getByRole("button", { name: "Copy snapshot link" }).click();
	await expect(page.getByText("Snapshot link copied")).toBeVisible({
		timeout: 30_000,
	});
	await expect(dialog).toBeHidden();
	const link = await page.evaluate(() => navigator.clipboard.readText());
	expect(link).toMatch(/\/explorer\?page=run%3A.+%40.+/);

	// A member opening the link lands on the frozen reading, not the live run.
	await page.goto(link);
	await expect(page.getByText("Snapshot", { exact: true }).first()).toBeVisible(
		{ timeout: 30_000 },
	);
});
