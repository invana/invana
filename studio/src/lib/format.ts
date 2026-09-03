/** Compact "k" count for meta lines: 250000 -> "250k", 300 -> "0.3k", 15000 -> "15k". */
export function formatCompactCount(n: number): string {
	const v = n / 1000;
	const decimals = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
	const trimmed =
		decimals > 0 ? v.toFixed(decimals).replace(/\.?0+$/, "") : v.toFixed(0);
	return `${trimmed}k`;
}
