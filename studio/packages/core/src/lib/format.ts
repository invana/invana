/** Compact "k" count for meta lines: 250000 -> "250k", 300 -> "0.3k", 15000 -> "15k". */
export function formatCompactCount(n: number): string {
	const v = n / 1000;
	const decimals = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
	const trimmed =
		decimals > 0 ? v.toFixed(decimals).replace(/\.?0+$/, "") : v.toFixed(0);
	return `${trimmed}k`;
}

/**
 * `820` · `8.2k` · `1.4m` — a magnitude, not a number.
 *
 * What a token total is read as: nobody compares run A's 8,214 against run B's
 * 8,190, they compare *thousands*. Distinct from {@link formatCompactCount},
 * which is always in `k` because its subject is records.
 */
export function formatCompact(n: number): string {
	if (n < 1000) return String(n);
	if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}
