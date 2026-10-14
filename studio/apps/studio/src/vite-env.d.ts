/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Share of new traces Studio keeps, 0–1; unset or invalid keeps every trace. */
	readonly VITE_TELEMETRY_SAMPLE_RATIO?: string;
	/** The collector's trace view, with `{trace_id}` in it; unset shows trace ids unlinked. */
	readonly VITE_TELEMETRY_TRACE_URL?: string;
}
