import { describe, expect, it } from "vitest";
import type { GraphAccess } from "../types/access";
import { gateOf, whoToAsk } from "./access";

const access: GraphAccess = {
	roles: ["viewer"],
	areas: [
		{
			area: "ask",
			label: "Asking and exploring",
			role: "viewer",
			allowed: true,
			holders: ["ravi", "arjun"],
		},
		{
			area: "build",
			label: "Agents, skills and evals",
			role: "builder",
			allowed: false,
			holders: ["ravi", "meera"],
		},
	],
};

describe("gateOf", () => {
	it("refuses an area without its role and names who to ask", () => {
		expect(gateOf(access, "build", "arjun")).toEqual({
			allowed: false,
			role: "builder",
			holders: ["ravi", "meera"],
			reason: "Needs the builder role — ask ravi or meera.",
		});
	});

	it("allows an area the member holds, and every area before access loads", () => {
		expect(gateOf(access, "ask", "arjun").allowed).toBe(true);
		expect(gateOf(undefined, "settings").allowed).toBe(true);
	});
});

describe("whoToAsk", () => {
	it("shortens a long list and never reads empty", () => {
		expect(whoToAsk(["a", "b", "c", "d"])).toBe("a, b or 2 others");
		expect(whoToAsk([])).toBe("an owner of this Graph");
	});
});
