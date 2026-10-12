/**
 * Graph settings › Members (MO-14, board `modeller.settings.members`).
 *
 * An owner adds a person with a role, re-roles them and removes them, all from
 * the tab; a viewer reads the same tab with every act drawn disabled — never
 * hidden. Uses only the `e2e-member` account, made by the admin.
 */
import { expect, type Page, test } from "@playwright/test";
import { GRAPH } from "./explorer";
import {
	ensureAccount,
	memberWithRoles,
	removeMember,
	signInAs,
} from "./members";

const MEMBER = "e2e-member";
const TAB = `${GRAPH}/modeller/settings?tab=members`;

test.describe.configure({ mode: "serial" });

const rowOf = (page: Page, username: string) =>
	page.getByRole("row").filter({ hasText: username });

test("MO-14 an owner adds, re-roles and removes a member", async ({ page }) => {
	await removeMember(page, MEMBER);
	await ensureAccount(page, MEMBER);
	await page.goto(TAB);

	await page.getByRole("button", { name: "Add member" }).click({
		timeout: 30_000,
	});
	const add = page.getByRole("dialog");
	await add.getByLabel("Email or username").fill(MEMBER);
	await add.getByLabel("builder", { exact: true }).check();
	await add.getByRole("button", { name: "Add member" }).click();
	await expect(add).toBeHidden();

	const row = rowOf(page, MEMBER);
	await expect(row).toContainText("builder");

	await row.getByRole("button", { name: `Edit ${MEMBER}` }).click();
	const edit = page.getByRole("dialog");
	await edit.getByLabel("modeller", { exact: true }).check();
	await edit.getByRole("button", { name: "Save roles" }).click();
	await expect(edit).toBeHidden();
	await expect(row).toContainText("modeller");
	await expect(row).toContainText("builder");

	await row.getByRole("button", { name: `Remove ${MEMBER}` }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Remove" })
		.click();
	await expect(rowOf(page, MEMBER)).toHaveCount(0);
});

test("MO-14 a viewer reads the members; Add member is disabled", async ({
	page,
	browser,
}) => {
	await memberWithRoles(page, MEMBER, ["viewer"]);
	const viewer = await signInAs(browser, MEMBER);
	try {
		await viewer.page.goto(TAB);
		await expect(rowOf(viewer.page, MEMBER)).toContainText("you", {
			timeout: 30_000,
		});
		await expect(rowOf(viewer.page, "admin")).toContainText("owner");
		const addMember = viewer.page.getByRole("button", { name: "Add member" });
		await expect(addMember).toBeDisabled();
		await expect(addMember).toHaveAccessibleDescription(
			/Needs the owner role — ask .+\./,
		);
	} finally {
		await viewer.close();
		await removeMember(page, MEMBER);
	}
});
