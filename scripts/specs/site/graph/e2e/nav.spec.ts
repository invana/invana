import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

/** The parse the site build wrote — titles come from the same front-matter the left tree reads. */
const graph = JSON.parse(
	readFileSync(
		resolve(import.meta.dirname, "../../build/graph/app/specs-graph.json"),
		"utf-8",
	),
) as {
	nodes: { id: string; kind: string; title: string; path: string | null }[];
	edges: { source: string; target: string; type: string }[];
};
const story = graph.nodes.find((n) => n.kind === "Story" && n.path);
const feature = graph.nodes.find(
	(n) =>
		n.kind === "Feature" &&
		graph.edges.some(
			(e) =>
				e.type === "PART_OF" && e.source === story?.id && e.target === n.id,
		),
);
const label = (n?: { id: string; title: string }) => `${n?.id} · ${n?.title}`;

test("the left tree reads titles, and a story folder is one entry", async ({
	page,
}) => {
	test.skip(!story || !feature, "no story with its feature in the parse");
	await page.goto(
		(story?.path ?? "").replace(/^specs\//, "").replace(/\.md$/, "/"),
	);
	const tree = page.locator("nav.md-nav--primary");
	await expect(tree.getByText("Operating system").first()).toBeVisible();
	await expect(tree.getByText(/^\s*Os\s*$/)).toHaveCount(0);
	// The feature's label links to its page — the section's index, not a second entry.
	await expect(
		tree.getByRole("link", { name: label(feature), exact: true }),
	).toHaveAttribute("href", /feature\/$/);
	await expect(
		tree.getByRole("link", { name: label(story), exact: true }).first(),
	).toBeVisible();
	await expect(tree.getByText(/^\s*(Features|Stories)\s*$/)).toHaveCount(0);
	await expect(tree.locator('a[href*="/task/"]')).toHaveCount(0);
});

test("the sitemap is not empty and lists the story pages", async ({
	request,
}) => {
	const xml = await (await request.get("sitemap.xml")).text();
	const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
	expect(urls).not.toHaveLength(0);
	test.skip(!story, "no story in the parse");
	const path = (story?.path ?? "")
		.replace(/^specs\//, "")
		.replace(/\.md$/, "/");
	expect(urls.some((u) => u.endsWith(path))).toBe(true);
});
