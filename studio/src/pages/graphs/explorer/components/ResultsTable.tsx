import {
	Button,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useState } from "react";

// Inline, windowed preview of tabular query results (RFC-033). Renders only the
// first `visible` rows so a large result never bloats the thread DOM; "Load
// more" reveals the next page from the already-fetched rows (no extra fetch).
//
// The window is by row *count* (PAGE below), not pixel height — every windowed
// row renders fully. An earlier `max-h` scroll wrapper clipped the rows to ~5
// and (Radix hides the scrollbar until hover) made a 10-row result look like it
// stopped at 5. The thread itself scrolls, so we only guard horizontal overflow.

const PAGE = 10;

export interface ResultsTableProps {
	rows: Record<string, unknown>[];
}

function renderCell(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

export function ResultsTable({ rows }: ResultsTableProps) {
	const [visible, setVisible] = useState(PAGE);
	const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
	const shown = rows.slice(0, visible);
	const remaining = rows.length - shown.length;

	if (columns.length === 0) {
		return <p className="mt-1 text-muted-foreground">No rows returned.</p>;
	}

	return (
		<div className="mt-1 overflow-hidden rounded border border-border">
			<div className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							{columns.map((c) => (
								<TableHead key={c}>{c}</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{shown.map((row, i) => (
							<TableRow
								key={`${i}:${columns.map((c) => renderCell(row[c])).join("|")}`}
							>
								{columns.map((c) => (
									<TableCell key={c} className="font-mono">
										{renderCell(row[c])}
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			{remaining > 0 && (
				<div className="border-t border-border p-1.5">
					<Button
						variant="ghost"
						size="sm"
						className="w-full"
						onClick={() => setVisible((v) => v + PAGE)}
					>
						Load {Math.min(PAGE, remaining)} more · {remaining} remaining
					</Button>
				</div>
			)}
		</div>
	);
}
