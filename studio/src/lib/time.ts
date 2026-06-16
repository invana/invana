/** Compact duration for meta lines: "<1ms" / "840ms" / "1.2s" / "12s".
 *  Input is whole milliseconds (the engine rounds), so 0 means sub-millisecond. */
export function formatDuration(ms: number): string {
	if (ms <= 0) return "<1ms";
	if (ms < 1000) return `${ms}ms`;
	const s = ms / 1000;
	return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
}

/** Compact "5 mins ago" style relative time for session/list meta lines. */
export function formatRelativeTime(date: Date): string {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
	if (seconds < 45) return "just now";

	const minutes = Math.floor(seconds / 60);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;

	const days = Math.floor(hours / 24);
	if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

	return date.toLocaleDateString();
}
