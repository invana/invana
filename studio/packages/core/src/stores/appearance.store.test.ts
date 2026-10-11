import { beforeEach, describe, expect, it } from "vitest";
import {
	SATURATION_DEFAULT,
	SATURATION_MAX,
	SATURATION_MIN,
	useAppearanceStore,
} from "./appearance.store";

describe("appearance store", () => {
	beforeEach(() => useAppearanceStore.getState().reset());

	it("keeps a saturation inside its range, rounded", () => {
		useAppearanceStore.getState().setSaturation(142.6);
		expect(useAppearanceStore.getState().saturation).toBe(143);
	});

	it("clamps what the slider cannot draw, and resets to the theme", () => {
		const { setSaturation, reset } = useAppearanceStore.getState();
		setSaturation(500);
		expect(useAppearanceStore.getState().saturation).toBe(SATURATION_MAX);
		setSaturation(-20);
		expect(useAppearanceStore.getState().saturation).toBe(SATURATION_MIN);
		reset();
		expect(useAppearanceStore.getState().saturation).toBe(SATURATION_DEFAULT);
	});
});
