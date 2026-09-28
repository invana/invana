import { describe, expect, it } from "vitest";
import { boardPageId, declaredPage, parseBoardPageId } from "./boardKinds";

describe("board page ids", () => {
	it("builds and parses a live page and a frozen reading", () => {
		expect(parseBoardPageId(boardPageId("run", "9f2c"))).toEqual({
			kind: "run",
			id: "9f2c",
		});
		expect(parseBoardPageId(boardPageId("run", "9f2c", "v2"))).toEqual({
			kind: "run",
			id: "9f2c",
			versionId: "v2",
		});
	});

	it("reads the legacy canvas: prefix as a data board", () => {
		expect(parseBoardPageId("canvas:abc")).toEqual({ kind: "data", id: "abc" });
	});

	it("refuses an unknown kind, a missing id or no kind at all", () => {
		expect(parseBoardPageId("nope:abc")).toBeNull();
		expect(parseBoardPageId("run:")).toBeNull();
		expect(parseBoardPageId("abc")).toBeNull();
	});

	it("names a declared page's subject, and nothing for a drawn one", () => {
		expect(declaredPage("rule:r1")).toEqual({ kind: "rule", subjectId: "r1" });
		expect(declaredPage("data:b1")).toBeNull();
	});
});
