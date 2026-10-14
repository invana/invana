/**
 * The board's legend, bottom-left while *Tools* is on: every node type and
 * relationship type drawn, its colour and how many of it are on the board.
 *
 * It counts what the board holds — the answer's records plus every
 * expansion — by reading the live graph store, and recounts only when the
 * store's version moves, checked twice a second.
 */
import { useGraphStore } from "@invana/canvas-react";
import { Card, Eyebrow, Legend, LegendItem } from "@invana/ui";
import { typeDotColor } from "@invana-studio/canvases";
import type { CanvasStyling } from "@invana-studio/shell";
import { useEffect, useState } from "react";

interface Counts {
	nodes: [string, number][];
	edges: [string, number][];
}

function tally(items: Iterable<{ type?: unknown }>): [string, number][] {
	const counts = new Map<string, number>();
	for (const item of items) {
		const type = String(item.type ?? "");
		counts.set(type, (counts.get(type) ?? 0) + 1);
	}
	return [...counts].sort((a, b) => b[1] - a[1]);
}

export function BoardLegend({ styling }: { styling: CanvasStyling }) {
	const store = useGraphStore("graph");
	const [counts, setCounts] = useState<Counts>({ nodes: [], edges: [] });

	useEffect(() => {
		if (!store) return;
		let seen = -1;
		const read = () => {
			if (store.version === seen) return;
			seen = store.version;
			setCounts({ nodes: tally(store.nodes()), edges: tally(store.edges()) });
		};
		read();
		const timer = window.setInterval(read, 500);
		return () => window.clearInterval(timer);
	}, [store]);

	if (!counts.nodes.length) return null;
	return (
		<Card className="flex w-60 flex-col gap-2 p-3 shadow-md">
			<Eyebrow>Node types</Eyebrow>
			<Legend orientation="column">
				{counts.nodes.map(([type, n]) => (
					<LegendItem
						key={type}
						label={type}
						count={n.toLocaleString()}
						color={typeDotColor(type, styling.nodeTypes?.[type]?.color)}
					/>
				))}
			</Legend>
			{counts.edges.length > 0 && (
				<>
					<Eyebrow>Relationships</Eyebrow>
					<Legend orientation="column">
						{counts.edges.map(([type, n]) => (
							<LegendItem
								key={type}
								kind="box"
								label={type}
								count={n.toLocaleString()}
								color={typeDotColor(type, styling.edgeTypes?.[type]?.color)}
							/>
						))}
					</Legend>
				</>
			)}
		</Card>
	);
}
