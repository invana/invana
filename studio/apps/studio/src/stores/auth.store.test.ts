import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/types/auth";
import { useAuthStore } from "./auth.store";

const user = { id: "u1", first_name: "Ada", graphs: [] } as unknown as AuthUser;

describe("auth store", () => {
	beforeEach(() => useAuthStore.getState().clear());

	it("holds a session, and a refresh replaces only the tokens", () => {
		const s = useAuthStore.getState();
		s.setSession({ user, accessToken: "a1", refreshToken: "r1" });
		s.setTokens({ accessToken: "a2", refreshToken: "r2" });
		const now = useAuthStore.getState();
		expect(now.user).toBe(user);
		expect(now.accessToken).toBe("a2");
		expect(now.refreshToken).toBe("r2");
	});

	it("clears the user and both tokens on sign-out", () => {
		const s = useAuthStore.getState();
		s.setSession({ user, accessToken: "a1", refreshToken: "r1" });
		s.clear();
		const now = useAuthStore.getState();
		expect([now.user, now.accessToken, now.refreshToken]).toEqual([
			null,
			null,
			null,
		]);
	});
});
