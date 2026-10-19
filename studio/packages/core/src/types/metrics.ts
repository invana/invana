/**
 * A number against the one before it, read by the engine — Studio formats it
 * and never divides. `ratio`: value / prior − 1 (`0.38` is 38% more);
 * `points`: value − prior for a rate (`0.012` is 1.2 pt).
 */
export interface Change {
	by: number;
	unit: "ratio" | "points";
	direction: "up" | "down" | "flat";
	/** Whether the move is good news for this number. */
	tone: "better" | "worse" | "neutral";
}
