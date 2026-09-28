/**
 * SSE subscription to the audit-event live tail (docs/for-developers/modules/operate/features/audit-and-activity.md § Live tail).
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
import { recordStreamReconnect } from "@/services/telemetry/metrics";
import { startAction, withTraceparent } from "@/services/telemetry/tracer";
import { useAuthStore } from "@/stores/auth.store";

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
	// `useAuth` deliberately does not expose the raw token; the store is where
	// it lives, and the EventSource URL needs it directly.
	const accessToken = useAuthStore((s) => s.accessToken);
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
		// Nobody clicked for this tail, so it opens its own short root: the span
		// ends when the connection opens or fails, and the engine's stream span
		// joins its trace through the URL's `traceparent`.
		const subscribe = startAction("events", "subscribe", {
			"invana.stream": "events",
			...(username && graphSlug
				? { "invana.graph": `${username}/${graphSlug}` }
				: {}),
		});
		const url = withTraceparent(
			`${BASE_URL}${path}?token=${encodeURIComponent(accessToken)}`,
			subscribe.ctx,
		);

		const key =
			scope === "graph"
				? (["events", "graph", username, graphSlug] as const)
				: (["events", "global"] as const);

		const es = new EventSource(url);
		const invalidate = () =>
			queryClient.invalidateQueries({ queryKey: key, exact: false });

		es.addEventListener("row", invalidate);
		es.addEventListener("lost", invalidate);
		es.onopen = () => subscribe.end("open");
		es.onerror = () => {
			subscribe.fail(new Error("event stream error"));
			// Browser auto-reconnects EventSource on transient drops; we leave
			// the retry policy to it, and count each drop it is retrying.
			if (es.readyState === EventSource.CONNECTING)
				recordStreamReconnect("events");
		};

		return () => {
			es.removeEventListener("row", invalidate);
			es.removeEventListener("lost", invalidate);
			es.close();
			subscribe.end("closed");
		};
	}, [enabled, accessToken, queryClient, scope, username, graphSlug]);
}
