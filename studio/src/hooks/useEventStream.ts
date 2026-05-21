/**
 * SSE subscription to the audit-event live tail (RFC-018 § Live tail).
 *
 * Opens a native `EventSource` against `/api/v1/u/.../events/stream` (per-graph)
 * or `/api/v1/events/stream` (global). On each `event: row` frame, invalidates
 * the corresponding TanStack Query so the visible list refetches from the top
 * and picks up the new row(s). On `event: lost` we do the same — the dropped
 * events come back via the refetch.
 *
 * `EventSource` doesn't support custom headers (no `Authorization: Bearer`),
 * so we pass the access token as a `?token=<jwt>` query param. The engine
 * reads that as an Authorization fallback on SSE endpoints only.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "./useAuth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8200";

interface BaseProps {
	/** When false the hook does nothing — used to gate the subscription. */
	enabled?: boolean;
}

interface GraphProps extends BaseProps {
	scope: "graph";
	username: string;
	graphSlug: string;
}

interface GlobalProps extends BaseProps {
	scope: "global";
}

type Props = GraphProps | GlobalProps;

/**
 * Subscribe to the audit-event stream and invalidate the corresponding
 * paginated query on each incoming frame. The hook owns the EventSource
 * lifecycle — close on unmount or when the scope changes.
 */
export function useEventStream(props: Props): void {
	const queryClient = useQueryClient();
	const { accessToken } = useAuth();
	const enabled = props.enabled !== false;

	// Pre-destructure the scope-dependent values so the dep array doesn't
	// include ternaries (Biome flags those as superfluous). The graph fields
	// are `undefined` for the global scope, which is a stable identity across
	// renders.
	const scope = props.scope;
	const username = scope === "graph" ? props.username : undefined;
	const graphSlug = scope === "graph" ? props.graphSlug : undefined;

	useEffect(() => {
		if (!enabled || !accessToken) return;

		const path =
			scope === "graph" && username && graphSlug
				? `/api/v1/u/${username}/${graphSlug}/events/stream`
				: "/api/v1/events/stream";
		const url = `${BASE_URL}${path}?token=${encodeURIComponent(accessToken)}`;

		const key =
			scope === "graph"
				? (["events", "graph", username, graphSlug] as const)
				: (["events", "global"] as const);

		const es = new EventSource(url);
		const invalidate = () =>
			queryClient.invalidateQueries({ queryKey: key, exact: false });

		es.addEventListener("row", invalidate);
		es.addEventListener("lost", invalidate);
		es.onerror = () => {
			// Browser auto-reconnects EventSource on transient drops; we leave
			// the retry policy to it. (Future: cap retries + fallback to polling.)
		};

		return () => {
			es.removeEventListener("row", invalidate);
			es.removeEventListener("lost", invalidate);
			es.close();
		};
	}, [enabled, accessToken, queryClient, scope, username, graphSlug]);
}
