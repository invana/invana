import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import type { IndexResponse } from "../../../../types/schemas";

interface Props {
	indexes: IndexResponse[];
}

export function IndexTable({ indexes }: Props) {
	if (indexes.length === 0) {
		return (
			<p className="text-sm text-muted-foreground py-2">No indexes defined.</p>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Name</TableHead>
					<TableHead>Index type</TableHead>
					<TableHead>On label</TableHead>
					<TableHead>Properties</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{indexes.map((idx) => (
					<TableRow key={idx.id}>
						<TableCell className="font-mono text-xs">{idx.name}</TableCell>
						<TableCell>{idx.index_type}</TableCell>
						<TableCell>{idx.target_label}</TableCell>
						<TableCell className="font-mono text-xs">
							{idx.properties.join(", ")}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
