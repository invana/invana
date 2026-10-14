import { expect, type Page, test } from "@playwright/test";
import { graphApi, graphStatus } from "./api";
import { GRAPH } from "./explorer";

/**
 * Impact (PJ-10): what an option reaches over the graph, read from the records
 * its evidence cites. One test draws a real reach from an airways airport;
 * one shows the empty state of an option whose evidence cites no record.
 *
 * The project is made here through the API, keyed `e2e-…`, and deleted after.
 * The cited record is found with a raw query asked in a throwaway session, so
 * the spec needs only `demos/airways`.
 */

const PROJECTS = `${GRAPH}/projects`;

/** A policy project with its first option (`b1`), made through the API. */
async function makeProject(page: Page, tag: string): Promise<string> {
	const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
	const made = await graphApi<{ key: string }>(page, "/projects", {
		method: "POST",
		data: {
			name: `E2E impact ${tag} ${stamp}`,
			key: `e2e-${stamp}`,
			type: "policy",
			question: `Does ${tag} reach far?`,
			first_branch: `${tag} as it stands`,
		},
	});
	await expect
		.poll(() => graphStatus(page, `/projects/${made.key}/branches/1`), {
			timeout: 10_000,
		})
		.toBe(200);
	return made.key;
}

async function removeProject(page: Page, key: string) {
	await graphApi(page, `/projects/${key}`, { method: "DELETE" });
}

function projectPage(key: string, query: Record<string, string> = {}) {
	const q = new URLSearchParams({ page: `project:${key}`, ...query });
	return `${PROJECTS}/${key}?${q}`;
}

/** The element id of one airport, read with a raw query in a throwaway session. */
async function airportId(page: Page, code: string): Promise<string> {
	const session = await graphApi<{ id: string }>(page, "/sessions", {
		method: "POST",
		data: {},
	});
	try {
		const { run_id } = await graphApi<{ run_id: string }>(
			page,
			`/sessions/${session.id}/messages`,
			{
				method: "POST",
				data: {
					content: `MATCH (a:airport {code: '${code}'}) RETURN elementId(a) AS id LIMIT 1`,
					mode: "ql",
					language: "cypher",
				},
			},
		);
		await expect
			.poll(
				async () =>
					(await graphApi<{ status: string }>(page, `/runs/${run_id}`)).status,
				{ timeout: 30_000 },
			)
			.toBe("succeeded");
		const emissions = await graphApi<
			{ kind: string; payload: { value?: unknown } }[]
		>(page, `/runs/${run_id}/emissions`);
		const id = emissions.find((e) => e.kind === "metric")?.payload.value;
		expect(typeof id, `airport ${code} is in the graph`).toBe("string");
		return id as string;
	} finally {
		await graphApi(page, `/sessions/${session.id}`, { method: "DELETE" });
	}
}

test("PJ-10 impact draws what an option's cited records reach", async ({
	page,
}) => {
	const id = await airportId(page, "LHR");
	const key = await makeProject(page, "Heathrow");
	try {
		await graphApi(page, `/projects/${key}/branches/1/findings`, {
			method: "POST",
			data: {
				statement: "Heathrow is the hub the option rests on",
				stance: "supports",
				cites: [{ kind: "record", ref: id }],
			},
		});
		await page.goto(projectPage(key, { view: "impact", of: "1", hops: "1" }));
		const links = page
			.locator("section")
			.filter({ has: page.getByText("Links", { exact: true }) });
		await expect(links.getByText(/^cited · 1 airport$/)).toBeVisible({
			timeout: 30_000,
		});
		await expect(links.getByText(/^1 hop · \d+ /).first()).toBeVisible({
			timeout: 30_000,
		});
		await expect(
			page.getByText(/^Traced in \d+ reads? of the graph$/),
		).toBeVisible();
		await expect(page.getByText("Most reached", { exact: true })).toBeVisible();
	} finally {
		await removeProject(page, key);
	}
});

test("PJ-10 impact says what to add when the evidence cites no record", async ({
	page,
}) => {
	const key = await makeProject(page, "nothing cited");
	try {
		await page.goto(projectPage(key, { view: "impact", of: "1" }));
		await expect(
			page.getByText(/^Impact starts from the graph records an? option's/),
		).toBeVisible({ timeout: 30_000 });
	} finally {
		await removeProject(page, key);
	}
});
