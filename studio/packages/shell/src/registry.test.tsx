import type { ProductDefinition } from "@invana-studio/core";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useAction } from "./actions";
import { ProductsProvider, productBase, productRoutes } from "./products";

const Icon = () => null;

const projects: ProductDefinition = {
	id: "projects",
	name: "Projects",
	tagline: "Questions, findings, decisions",
	icon: Icon,
	scope: "graph",
	routes: [{ path: "u/:username/:graphSlug/projects", handle: { crumb: "x" } }],
	nav: null,
	landing: "",
	actions: {
		"projects.addFinding": {
			label: "Add finding",
			run: ({ navigate }) => navigate("/somewhere"),
		},
	},
};

function ActionLabel({ id }: { id: string }) {
	const action = useAction(id);
	return <span>{action ? action.label : "absent"}</span>;
}

function render(id: string, products: ProductDefinition[]) {
	return renderToString(
		<MemoryRouter>
			<ProductsProvider products={products}>
				<ActionLabel id={id} />
			</ProductsProvider>
		</MemoryRouter>,
	);
}

describe("product registry", () => {
	it("resolves an action a registered product offers", () => {
		expect(render("projects.addFinding", [projects])).toContain("Add finding");
	});

	it("returns null when the owning product is not registered", () => {
		expect(render("projects.addFinding", [])).toContain("absent");
	});

	it("stamps each product route with its product and keeps its handle", () => {
		const [route] = productRoutes([projects]);
		expect(route.handle).toEqual({ crumb: "x", product: "projects" });
	});

	it("puts a graph product under the open Graph, and has no base without one", () => {
		const graph = { username: "admin", graphSlug: "airways" };
		expect(productBase(projects, graph)).toBe("/u/admin/airways/projects");
		expect(productBase(projects, undefined)).toBeUndefined();
	});
});
