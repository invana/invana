/**
 * The Filters side panel: which kinds, statuses, personas and products the graph shows.
 *
 * Kind and status start with every value on but the kinds hidden on load; persona and product start empty, which
 * means "all". Each value carries its node count from the parse. What a persona and a product narrow to is
 * `visibleIds` in `model.ts`.
 */
import {
	Button,
	ScrollArea,
	SectionHeader,
	ToggleGroup,
	ToggleGroupItem,
} from "@invana/ui";
import { RotateCcw } from "lucide-react";
import { defaultFilters, type Filters, type GraphIndex } from "./model";

interface Props {
	index: GraphIndex;
	filters: Filters;
	onChange: (next: Filters) => void;
}

interface Dimension {
	key: keyof Filters;
	title: string;
	/** Value, label and count. */
	options: [string, string, number][];
	/** What an empty selection means. */
	empty: string;
}

export function FiltersPanel({ index, filters, onChange }: Props) {
	const { counts } = index;
	const dimensions: Dimension[] = [
		{
			key: "kinds",
			title: "Kind",
			options: counts.kinds.map(([k, n]) => [k, k, n]),
			empty: "nothing shown",
		},
		{
			key: "statuses",
			title: "Status",
			options: counts.statuses.map(([s, n]) => [s, s, n]),
			empty: "nothing shown",
		},
		{
			key: "personas",
			title: "Persona — what serves them",
			options: counts.personas,
			empty: "everyone",
		},
		{
			key: "products",
			title: "Product — and what it touches",
			options: counts.products,
			empty: "every product",
		},
	];
	return (
		<ScrollArea className="h-full">
			<SectionHeader
				title="Filters"
				actions={
					<Button
						size="sm"
						variant="ghost"
						onClick={() => onChange(defaultFilters(index))}
					>
						<RotateCcw />
						Reset
					</Button>
				}
			/>
			{dimensions.map((d) => (
				<section key={d.key} aria-label={d.title}>
					<SectionHeader
						title={d.title}
						count={
							filters[d.key].size === 0
								? d.empty
								: `${filters[d.key].size} of ${d.options.length}`
						}
					/>
					<ToggleGroup
						type="multiple"
						variant="outline"
						size="sm"
						className="flex flex-wrap justify-start gap-1 p-2"
						value={[...filters[d.key]]}
						onValueChange={(values: string[]) =>
							onChange({ ...filters, [d.key]: new Set(values) })
						}
					>
						{d.options.map(([value, label, n]) => (
							<ToggleGroupItem key={value} value={value} aria-label={label}>
								{label} · {n}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</section>
			))}
		</ScrollArea>
	);
}
