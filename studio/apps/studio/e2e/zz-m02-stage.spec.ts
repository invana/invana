// Throwaway: stages the drafts the M02 boards are shot on. Deleted after use.
import { test } from "@playwright/test";
import { graphApi } from "./api";

type Model = { id: string; name: string };
type Version = { id: string; status: string; version: string | null };
type Mapping = { property_key: { name: string } };
type NodeType = { id: string; name: string; property_mappings: Mapping[] };
type Tree = { node_types: NodeType[]; property_keys: { name: string }[] };

async function draftOf(page: Parameters<typeof graphApi>[0], name: string) {
	const models = await graphApi<Model[]>(page, "/models");
	const model = models.find((m) => m.name === name);
	if (!model) throw new Error(`no model ${name}`);
	const versions = await graphApi<Version[]>(
		page,
		`/models/${model.id}/versions`,
	);
	let draft = versions.find((v) => v.status === "draft");
	if (!draft) {
		const active = versions.find((v) => v.status === "active");
		draft = await graphApi<Version>(page, `/models/${model.id}/versions`, {
			method: "POST",
			data: { based_on: active?.version ?? null },
		});
	}
	const base = `/models/${model.id}/versions/${draft.id}`;
	const tree = await graphApi<Tree>(page, base);
	return { model, draft, base, tree };
}

test("stage an additive and a breaking draft", async ({ page }) => {
	const air = await draftOf(page, "AirRoutes");
	if (!air.tree.property_keys.some((k) => k.name === "timezone"))
		await graphApi(page, `${air.base}/property-keys`, {
			method: "POST",
			data: { name: "timezone", type: "string" },
		});
	const airport = air.tree.node_types.find((t) => t.name === "airport");
	if (
		airport &&
		!airport.property_mappings.some((m) => m.property_key.name === "timezone")
	)
		await graphApi(page, `${air.base}/node-types/${airport.id}`, {
			method: "PATCH",
			data: {
				property_mappings: [
					...airport.property_mappings.map((m) => ({
						property_key: m.property_key.name,
					})),
					{ property_key: "timezone" },
				],
			},
		});

	const deals = await draftOf(page, "Deals");
	const deal = deals.tree.node_types.find((t) => t.name === "Deal");
	if (deal && deal.property_mappings.length > 1)
		await graphApi(page, `${deals.base}/node-types/${deal.id}`, {
			method: "PATCH",
			data: {
				property_mappings: deal.property_mappings
					.slice(0, -1)
					.map((m) => ({ property_key: m.property_key.name })),
			},
		});
	console.log(
		JSON.stringify({ airroutes: air.model.id, deals: deals.model.id }),
	);
});
