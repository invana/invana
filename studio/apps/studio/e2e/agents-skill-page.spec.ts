/**
 * The skill page (the-skill-page.md): a new skill opens as an `untitled`
 * draft on Instructions with the four headings; the open tab is `?tab=` and a
 * reload keeps it; a published skill's Flow draws its plan. Reads seeded
 * skills from `demos/airways`; the draft it makes is deleted in `finally`.
 */
import { expect, type Page, test } from "@playwright/test";
import { graphApi } from "./api";
import { GRAPH } from "./explorer";

const SKILLS = `${GRAPH}/agents/skills`;

interface SkillRow {
	id: string;
	name: string;
	is_draft: boolean;
	plan: { step_count: number } | null;
}

/** A published seeded skill whose plan has steps. */
async function publishedSkill(page: Page): Promise<SkillRow> {
	const { items } = await graphApi<{ items: SkillRow[] }>(
		page,
		"/skills?limit=200",
	);
	const skill = items.find((s) => !s.is_draft && (s.plan?.step_count ?? 0) > 0);
	expect(skill, "a published skill with a plan").toBeTruthy();
	return skill as SkillRow;
}

test("New skill opens an untitled draft on Instructions with the four headings", async ({
	page,
}) => {
	await page.goto(SKILLS);
	await page
		.getByRole("button", { name: "New skill" })
		.click({ timeout: 30_000 });
	await expect(page).toHaveURL(/[?&]page=skill(:|%3A)/, { timeout: 15_000 });
	const id = decodeURIComponent(
		new URL(page.url()).searchParams.get("page") ?? "",
	).split(":")[1];
	try {
		await expect(
			page.getByRole("tab", { name: "Instructions" }),
		).toHaveAttribute("aria-selected", "true");
		await expect(page.getByText(/^untitled(-\d+)?$/).first()).toBeVisible();
		for (const heading of [
			"## Goal",
			"## Arguments",
			"## Steps",
			"## When things go wrong",
		])
			await expect(page.getByText(heading, { exact: true })).toBeVisible({
				timeout: 15_000,
			});
		await expect(page.getByText(/^Nothing to draw yet/)).toBeVisible();
	} finally {
		if (id)
			await graphApi(page, `/skills/${id}`, { method: "DELETE" }).catch(
				() => {},
			);
	}
});

test("a tab switch writes ?tab= and a reload keeps it", async ({ page }) => {
	const skill = await publishedSkill(page);
	await page.goto(`${SKILLS}?page=skill:${skill.id}`);
	await page.getByRole("tab", { name: "Usage" }).click({ timeout: 30_000 });
	await expect(page).toHaveURL(/[?&]tab=usage/);
	await page.reload();
	await expect(page.getByRole("tab", { name: "Usage" })).toHaveAttribute(
		"aria-selected",
		"true",
		{ timeout: 30_000 },
	);
	await expect(page).toHaveURL(/[?&]page=skill(:|%3A)/);
});

test("Flow draws a published skill's plan with its lines", async ({ page }) => {
	const skill = await publishedSkill(page);
	await page.goto(`${SKILLS}?page=skill:${skill.id}&tab=flow`);
	await expect(
		page.getByText("From the instructions", { exact: true }),
	).toBeVisible({
		timeout: 30_000,
	});
	await expect(
		page.getByText(/^Drawn from the instructions, v\d+\./),
	).toBeVisible();
	await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
});
