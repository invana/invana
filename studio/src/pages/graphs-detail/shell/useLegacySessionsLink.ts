import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { useLeftSection } from "@/pages/graphs-detail/shared/useLeftSection";

/**
 * Rewrites an old `?panel=sessions` link to where the sessions live now — the
 * assistant, on the right side — in one URL write. Called by the Graph page
 * only, once, with the `leftSection` state it already holds.
 */
export function useLegacySessionsLink(
	settingsPanel: ReturnType<typeof useLeftSection>,
) {
	// Page state lives in the URL, one param per region (graph-detail-page.md
	// ). `setSearchParams` is here for the one-write legacy migration below;
	// each region reads and writes its own param through its own hook.
	const [, setSearchParams] = useSearchParams();
	// Sessions used to be a left-rail panel. Links carrying `?panel=sessions`
	// (and `?panel=messages`, which aliases onto it) still exist, so honour
	// them where the panel actually lives now: open the assistant, drop the rail
	// key. One write, not two — `settingsPanel.close()` followed by
	// `right.open("assistant")` would each rebuild the query string from its own
	// snapshot, the second restoring the key the first removed, and the effect
	// would fire forever on the URL it just wrote.
	const staleSessionsKey =
		settingsPanel.isOpen && settingsPanel.section === "sessions";
	useEffect(() => {
		if (!staleSessionsKey) return;
		setSearchParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.delete("settings");
				if (!next.has("right")) next.set("right", "assistant");
				return next;
			},
			{ replace: true },
		);
	}, [staleSessionsKey, setSearchParams]);
}
