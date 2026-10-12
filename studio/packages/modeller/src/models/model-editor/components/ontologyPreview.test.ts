import { describe, expect, it } from "vitest";
import type { OntologyImportResult } from "../../types";
import {
	compactIri,
	mappingRows,
	namespaceLabel,
	parseTypeNames,
	previewDescription,
	summaryCounts,
} from "./ontologyPreview";

const result: OntologyImportResult = {
	draft: {
		schema_name: "tiny",
		property_keys: [],
		node_types: [],
		edge_types: [
			{
				name: "WORKS_FOR",
				source_node_types: ["Person"],
				target_node_types: ["Organization"],
			},
		],
	},
	report: {
		format: "turtle",
		triples: 20,
		mapped: { node_types: 2, edge_types: 1, property_keys: 1 },
		types: [
			{
				name: "Person",
				iri: "https://schema.org/Person",
				kind: "node",
				properties: ["fullName"],
				inherited: [],
			},
			{
				name: "Organization",
				iri: "http://example.org/onto#Organization",
				kind: "node",
				came_with: "Person.worksFor",
				properties: [],
				inherited: [{ property: "name", from_type: "Thing" }],
			},
			{
				name: "WORKS_FOR",
				iri: "http://example.org/onto#worksFor",
				kind: "edge",
				properties: [],
				inherited: [],
			},
		],
		skipped: [
			{
				iri: "http://www.w3.org/2002/07/owl#Restriction",
				subject: "Person",
				kind: "restriction",
				message: "restrictions are not imported",
			},
		],
		skipped_count: 3,
		notes: [],
		notes_count: 0,
		suggestions: [
			{
				kind: "same_as",
				name: "Person",
				iri: "https://schema.org/Person",
				target_iri: "http://www.wikidata.org/entity/Q5",
			},
		],
	},
	unsupported_property_types: [],
	publishable: true,
};

describe("ontology preview", () => {
	it("compacts known namespaces and labels where a class comes from", () => {
		expect(compactIri("https://schema.org/Person")).toBe("schema:Person");
		expect(compactIri("http://www.w3.org/2002/07/owl#Restriction")).toBe(
			"owl:Restriction",
		);
		expect(compactIri("http://example.org/onto#Place")).toBe("Place");
		expect(namespaceLabel("https://www.schema.org/Person")).toBe("schema.org");
		expect(namespaceLabel("urn:ex:onto#Place")).toBe("urn:ex:onto");
		expect(parseTypeNames(" Person, ,Organization ")).toEqual([
			"Person",
			"Organization",
		]);
	});

	it("maps node, edge, stitch and skipped rows in that order", () => {
		const rows = mappingRows(result);
		expect(rows.map((r) => r.kind)).toEqual([
			"node",
			"node",
			"edge",
			"stitch",
			"skipped",
		]);
		expect(rows[1].note).toBe(
			"0 properties · came with Person.worksFor · inherits 1, noted",
		);
		expect(rows[2].note).toBe("Person → Organization");
		expect(rows[3].source).toBe("Person · sameAs Q5");
		expect(rows[4].source).toBe("owl:Restriction");
		expect(summaryCounts(result.report)).toMatchObject({
			types: "2 types · 1 edge",
			moreSkipped: 2,
		});
		expect(previewDescription(["Person"], result.report)).toBe(
			"Person + 1 they need",
		);
		expect(previewDescription([], result.report)).toBe("every class");
	});
});
