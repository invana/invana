import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import type { TypePropertyMappingResponse } from "../../../../types/schemas";

interface Props {
	mappings: TypePropertyMappingResponse[];
}

export function PropertyMappingTable({ mappings }: Props) {
	if (mappings.length === 0) {
		return <p className="text-muted-foreground py-2">No properties defined.</p>;
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Name</TableHead>
					<TableHead>Data type</TableHead>
					<TableHead>Cardinality</TableHead>
					<TableHead>Rules</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{mappings.map((m) => (
					<TableRow key={m.id}>
						<TableCell className="font-mono text-xs">
							{m.property_key.name}
						</TableCell>
						<TableCell>{m.property_key.type}</TableCell>
						<TableCell>{m.property_key.value_cardinality}</TableCell>
						<TableCell>
							{m.property_key.validation_rules.length > 0
								? m.property_key.validation_rules
										.map((r) => r.rule_type)
										.join(", ")
								: "—"}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
