import { Badge } from "@invana/ui";

/**
 * The tag on anything shown but not yet launched — an experimental product's
 * wordmark, its launcher row, or an act inside a launched product (shell.md ›
 * *Experimental products*).
 *
 * Experimental means labelled, never hidden: the person sees the act and
 * learns it is early, instead of finding it missing. One word, one tone, so
 * every surface reads the same.
 */
export function ExperimentalBadge({ className }: { className?: string }) {
	return (
		<Badge variant="soft" tone="warning" size="xs" className={className}>
			Experimental
		</Badge>
	);
}
