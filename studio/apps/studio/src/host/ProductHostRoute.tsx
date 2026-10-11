/**
 * The page a graph product's routes draw — Explorer, Modeller, Projects and
 * Agents hand it in as their slot's `Page`, because the host composes all
 * four (the Workbook's boards, `leftSection`'s panels, the assistant on the
 * right, the Console) and a product may not import another.
 *
 * An old link (`?panel=`, `?settings=`, `?drawer=`, a product's bare root) is
 * sent to its path before the host renders (`<CanonicalRoute>`).
 */
import { CanonicalRoute } from "@invana-studio/shell";
import { lazy, Suspense } from "react";

// Lazy-loaded — the host carries the heaviest UI (graph rendering). Lazy keeps
// the auth + settings flows snappy and isolates any canvas-side regressions to
// their own chunk.
const ProductHost = lazy(() =>
	import("@/host/ProductHost").then((m) => ({
		default: m.ProductHost,
	})),
);
const LazyFallback = () => (
	<div className="p-8 text-muted-foreground">Loading…</div>
);

/** The host, once the location is canonical. */
export function ProductHostRoute() {
	return (
		<CanonicalRoute>
			<Suspense fallback={<LazyFallback />}>
				<ProductHost />
			</Suspense>
		</CanonicalRoute>
	);
}
