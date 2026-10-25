/**
 * A titled card holding a small counted table — By actor's Graph data, Web,
 * LLM and Acted through; Refusals' top functions. The engine counted every
 * cell; the table only lays them out, and says so when there is nothing.
 */

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import type { ReactNode } from "react";

export interface CountColumn<T> {
	header: string;
	cell: (row: T) => ReactNode;
	/** Numbers sit right, in mono. */
	numeric?: boolean;
}

export function CountTable<T>({
	title,
	rows,
	columns,
	rowKey,
	empty,
}: {
	title: string;
	rows: T[];
	columns: CountColumn<T>[];
	rowKey: (row: T) => string;
	/** What an empty table says. */
	empty: string;
}) {
	return (
		<PanelSection card title={title}>
			{rows.length === 0 ? (
				<p className="py-2 text-muted-foreground">{empty}</p>
			) : (
				<Table density="compact">
					<TableHeader>
						<TableRow>
							{columns.map((c) => (
								<TableHead key={c.header}>{c.header}</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={rowKey(row)}>
								{columns.map((c) => (
									<TableCell
										key={c.header}
										className={c.numeric ? "font-mono" : undefined}
									>
										{c.cell(row)}
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</PanelSection>
	);
}
