/**
 * Share of new traces to keep, read from `VITE_TELEMETRY_SAMPLE_RATIO`.
 *
 * Anything that is not a number between 0 and 1 keeps every trace, so a typo
 * never silently turns tracing off. Kept apart from ./setup, which registers
 * the provider on import, so it can be tested on its own.
 */
export function sampleRatio(raw: string | undefined): number {
	const ratio = raw?.trim() ? Number(raw) : Number.NaN;
	return Number.isFinite(ratio) && ratio >= 0 && ratio <= 1 ? ratio : 1;
}
