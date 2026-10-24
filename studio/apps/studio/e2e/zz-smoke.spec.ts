import { expect, test } from "@playwright/test";

const PANELS = ["govern", "library", "skills", "projects", "agents"];

test("every panel renders with no module or runtime error", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(`pageerror: ${e}`));
	page.on("console", (m) => {
		if (m.type() === "error" && !m.text().includes("403"))
			errors.push(m.text());
	});

	for (const panel of PANELS) {
		await page.goto(`/u/admin/airways?panel=${panel}`);
		// The Graph switcher, not the breadcrumb: a product's root (Projects) has no crumb.
		await expect(
			page.getByRole("button", { name: "Switch graph" }),
		).toBeVisible({ timeout: 30_000 });
		await page.waitForTimeout(1500);
	}

	// The two surfaces this session changed, drilled in.
	await page.goto(
		"/u/admin/airways?panel=library&section=plans&plan=nl-single",
	);
	await expect(page.getByText(/^Each step, across \d+ runs?$/)).toBeVisible({
		timeout: 30_000,
	});

	await page.goto("/u/admin/airways?panel=skills");
	await page
		.getByText("Brief the route desk", { exact: true })
		.click({ timeout: 30_000 });
	await page.getByRole("button", { name: "Open", exact: true }).click();
	await page.getByRole("tab", { name: /^Plan/ }).click();
	await expect(page.getByText(/^Composed —/)).toBeVisible({ timeout: 30_000 });
	await page.waitForTimeout(1000);

	console.log("ERRORS:", JSON.stringify(errors, null, 1));
	expect(errors).toEqual([]);
});
