import { expect, test } from "@playwright/test";

const PATHS = [
	"modeller/worlds",
	"projects",
	"agents/home",
	"agents/fleet",
	"agents/fleet/map",
	"agents/fleet/table",
	"agents/performance",
	"agents/agents",
	"agents/skills",
	"agents/functions",
	"agents/functions/plans",
	"agents/functions/templates",
	"agents/functions/plugins",
	"agents/connections/server",
	"agents/connections/mcp",
	"agents/llms",
	"agents/settings",
];

test("every panel and Agents page renders with no module or runtime error", async ({
	page,
}) => {
	test.setTimeout(PATHS.length * 15_000);
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(`pageerror: ${e}`));
	page.on("console", (m) => {
		if (m.type() === "error" && !m.text().includes("403"))
			errors.push(m.text());
	});

	for (const path of PATHS) {
		await page.goto(`/u/admin/airways/${path}`);
		// The Graph switcher, not the breadcrumb: a product's root (Projects) has no crumb.
		await expect(
			page.getByRole("button", { name: "Switch graph" }),
		).toBeVisible({ timeout: 30_000 });
		await page.waitForTimeout(1500);
	}

	// A skill opens as a tab of its own beside Skills, its plan drawn.
	await page.goto("/u/admin/airways/agents/skills");
	await page
		.getByText("Brief the route desk", { exact: true })
		.click({ timeout: 30_000 });
	await page.getByRole("tab", { name: "Flow" }).click();
	await expect(
		page.getByText(/^Drawn from the instructions, v\d+\./),
	).toBeVisible({ timeout: 30_000 });
	await page.waitForTimeout(1000);

	console.log("ERRORS:", JSON.stringify(errors, null, 1));
	expect(errors).toEqual([]);
});
