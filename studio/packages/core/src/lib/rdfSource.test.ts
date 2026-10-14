import { describe, expect, it } from "vitest";
import { fetchRdfText, RDF_MAX_CHARS, readRdfFile } from "./rdfSource";

describe("readRdfFile", () => {
	it("reads a file's text and names it", async () => {
		const file = new File(["@prefix ex: <https://e.org/> ."], "tiny.ttl");
		expect(await readRdfFile(file)).toEqual({
			text: "@prefix ex: <https://e.org/> .",
			label: "tiny.ttl",
		});
	});

	it("refuses an empty file and one over the engine's cap", async () => {
		await expect(readRdfFile(new File(["  "], "empty.ttl"))).rejects.toThrow(
			"empty.ttl is empty.",
		);
		const big = new File(["x".repeat(RDF_MAX_CHARS + 1)], "big.ttl");
		await expect(readRdfFile(big)).rejects.toThrow(/over 20 MB/);
	});
});

describe("fetchRdfText", () => {
	it("refuses what is not an http(s) URL", async () => {
		await expect(fetchRdfText("ftp://e.org/v.ttl")).rejects.toThrow(
			"A URL starts with http:// or https://.",
		);
	});

	it("names a URL the browser could not read", async () => {
		await expect(fetchRdfText("http://127.0.0.1:1/v.ttl")).rejects.toThrow(
			/could not read that URL/,
		);
	});
});
