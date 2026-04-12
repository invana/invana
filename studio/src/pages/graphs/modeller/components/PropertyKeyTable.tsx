import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import type {
	EdgeTypeResponse,
	NodeTypeResponse,
	PropertyKeyResponse,
} from "../../../../types/schemas";

interface Props {
	propertyKeys: PropertyKeyResponse[];
	nodeTypes: NodeTypeResponse[];
	edgeTypes: EdgeTypeResponse[];
}

export function PropertyKeyTable({
	propertyKeys,
	nodeTypes,
	edgeTypes,
}: Props) {
	// Compute "Used by" client-side from all type mappings
	const usedBy = (keyName: string): string => {
		const labels: string[] = [];
		for (const nt of nodeTypes) {
			if (nt.property_mappings.some((m) => m.property_key.name === keyName)) {
				labels.push(nt.name);
			}
		}
		for (const et of edgeTypes) {
			if (et.property_mappings.some((m) => m.property_key.name === keyName)) {
				labels.push(et.name);
			}
		}
		return labels.length > 0 ? labels.join(", ") : "—";
	};

	if (propertyKeys.length === 0) {
		return (
			<p className="text-sm text-muted-foreground py-2">
				No property keys defined.
			</p>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Name</TableHead>
					<TableHead>Type</TableHead>
					<TableHead>Cardinality</TableHead>
					<TableHead>Used by</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{propertyKeys.map((pk) => (
					<TableRow key={pk.id}>
						<TableCell className="font-mono text-xs">{pk.name}</TableCell>
						<TableCell>{pk.type}</TableCell>
						<TableCell>{pk.value_cardinality}</TableCell>
						<TableCell className="text-muted-foreground text-xs">
							{usedBy(pk.name)}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
