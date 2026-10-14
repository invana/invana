/**
 * The comparisons owed to re-runs on current versions — held by the browser
 * that asked.
 *
 * A re-run on **current** versions exists to be compared with its original,
 * so when it finishes its page opens `compare:<re-run>:<original>` by itself.
 * The pair is kept here, in memory, between the dialog that opened the re-run
 * and the new run's page that sees it settle: set before navigating, taken
 * once. A reload loses only the automatic opening — a re-run's page always
 * carries *Compare with the original*.
 */

const pending = new Map<string, string>();

/** Owe a comparison: when `rerunId` settles, compare it with `originalId`. */
export function expectCompare(rerunId: string, originalId: string): void {
	pending.set(rerunId, originalId);
}

/** The original a settled re-run is owed a comparison with — once, then cleared. */
export function takeCompare(rerunId: string): string | null {
	const original = pending.get(rerunId) ?? null;
	pending.delete(rerunId);
	return original;
}
