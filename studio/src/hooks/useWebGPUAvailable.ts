import { useEffect, useState } from "react";

/**
 * Synchronous best-guess for WebGPU support: the API surface is present. Cheap
 * enough to run in a `useState` initializer to pick a default render backend.
 * The presence of `navigator.gpu` doesn't guarantee a usable adapter — use
 * {@link useWebGPUAvailable} when the answer drives UI that can wait a tick.
 */
export function hasWebGPUApi(): boolean {
	return typeof navigator !== "undefined" && "gpu" in navigator;
}

/**
 * Whether WebGPU is actually usable. Starts from the synchronous API-presence
 * check, then refines it by requesting an adapter — some browsers expose
 * `navigator.gpu` but hand back no adapter (e.g. blocklisted drivers), in which
 * case WebGPU isn't really available and the option should be disabled.
 */
export function useWebGPUAvailable(): boolean {
	const [available, setAvailable] = useState(hasWebGPUApi);

	useEffect(() => {
		if (!hasWebGPUApi()) return;
		let cancelled = false;
		navigator.gpu
			.requestAdapter()
			.then((adapter) => {
				if (!cancelled) setAvailable(!!adapter);
			})
			.catch(() => {
				if (!cancelled) setAvailable(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return available;
}
