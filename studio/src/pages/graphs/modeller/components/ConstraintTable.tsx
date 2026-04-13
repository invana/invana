import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import type { ConstraintResponse } from "../../../../types/schemas";

interface Props {
	constraints: ConstraintResponse[];
}

export function ConstraintTable({ constraints }: Props) {
	if (constraints.length === 0) {
		return (
			<p className="text-muted-foreground py-2">No constraints defined.</p>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Name</TableHead>
					<TableHead>Type</TableHead>
					<TableHead>On label</TableHead>
					<TableHead>Properties</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{constraints.map((c) => (
					<TableRow key={c.id}>
						<TableCell className="font-mono text-xs">{c.name}</TableCell>
						<TableCell>{c.constraint_type}</TableCell>
						<TableCell>{c.target_label}</TableCell>
						<TableCell className="font-mono text-xs">
							{c.properties.join(", ")}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
