/**
 * Agents without the builder role (SH-20, board `agents.skills.detail.readonly`).
 *
 * A viewer opens a skill and reads it: the page opens with the line saying
 * what they may do and who to ask, and *Edit instructions* is drawn disabled —
 * never hidden. The admin, who holds every role, sees neither. Reads a seeded
 * skill; needs `demos/airways`.
 */
import { expect, test } from "@playwright/test";
import { skillNamed } from "./api";
import { GRAPH } from "./explorer";
import { memberWithRoles, signInAs } from "./members";

const SKILL = "Answer in natural language";
const NOTICE =
	/You can read this skill\. Editing needs the builder role — ask .+\./;

test("SH-20 a viewer reads a skill; Edit instructions is disabled, with who to ask", async ({
	page,
	browser,
}) => {
	const id = await skillNamed(page, SKILL);
	await memberWithRoles(page, "e2e-viewer", ["viewer"]);
	const viewer = await signInAs(browser, "e2e-viewer");
	try {
		await viewer.page.goto(`${GRAPH}/agents/skills?page=skill:${id}`);
		await expect(viewer.page.getByText(NOTICE)).toBeVisible({
			timeout: 30_000,
		});
		const edit = viewer.page.getByRole("button", {
			name: "Edit instructions",
		});
		await expect(edit).toBeDisabled();
		await expect(edit).toHaveAccessibleDescription(
			/Needs the builder role — ask .+\./,
		);
	} finally {
		await viewer.close();
	}
});

test("SH-20 the admin edits a skill; no read-only notice", async ({ page }) => {
	const id = await skillNamed(page, SKILL);
	await page.goto(`${GRAPH}/agents/skills?page=skill:${id}`);
	const edit = page.getByRole("button", { name: "Edit instructions" });
	await expect(edit).toBeEnabled({ timeout: 30_000 });
	await expect(page.getByText(NOTICE)).toHaveCount(0);
});
