import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	ToggleGroup,
	ToggleGroupItem,
} from "@invana/ui";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type {
	ExpandDirection,
	ExpandRequest,
	FilterExpression,
	FilterGroup,
	FilterOp,
	NeighborExpandResponse,
	SortDirection,
	SortSpec,
} from "../../../../types/traversal";
import type { ExpandMenuSchema } from "./ExplorerCanvas";

const ANY = "__any__";

const OPS: { value: FilterOp; label: string; noValue?: boolean }[] = [
	{ value: "eq", label: "=" },
	{ value: "neq", label: "≠" },
	{ value: "gt", label: ">" },
	{ value: "gte", label: "≥" },
	{ value: "lt", label: "<" },
	{ value: "lte", label: "≤" },
	{ value: "contains", label: "contains" },
	{ value: "starts_with", label: "starts with" },
	{ value: "ends_with", label: "ends with" },
	{ value: "is_null", label: "is null", noValue: true },
	{ value: "is_not_null", label: "is not null", noValue: true },
];

interface FilterRow {
	property: string;
	op: FilterOp;
	value: string;
}

interface Props {
	open: boolean;
	vertexId: string;
	schema: ExpandMenuSchema | null;
	propertyKeys: string[];
	onClose: () => void;
	/** Runs the expand + merges into the canvas; returns the response for pagination. */
	onExpand: (req: ExpandRequest) => Promise<NeighborExpandResponse | null>;
}

// "42" / "-3.5" → number so numeric comparisons match the stored type; else the raw string.
function coerce(value: string): unknown {
	if (/^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
	return value;
}

export function ExpandFineTunePanel({
	open,
	vertexId,
	schema,
	propertyKeys,
	onClose,
	onExpand,
}: Props) {
	const [direction, setDirection] = useState<ExpandDirection>("both");
	const [edgeLabel, setEdgeLabel] = useState<string>(ANY);
	const [neighborLabel, setNeighborLabel] = useState<string>(ANY);
	const [pageSize, setPageSize] = useState(50);
	// Ordered list of sort keys — row order is the sort priority (primary first).
	const [sorts, setSorts] = useState<SortSpec[]>([]);
	const [filters, setFilters] = useState<FilterRow[]>([]);
	const [loaded, setLoaded] = useState(0);
	const [total, setTotal] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);

	// Reset accumulated pagination whenever the target node or any query knob
	// changes — the next "Load" should start a fresh page-0 fetch.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs to reset pagination when any knob changes
	useEffect(() => {
		setLoaded(0);
		setTotal(null);
	}, [vertexId, direction, edgeLabel, neighborLabel, pageSize, sorts, filters]);

	function buildRequest(offset: number): ExpandRequest {
		const base = {
			vertex_id: vertexId,
			direction,
			limit: pageSize,
			offset,
			sort: sorts.filter((s) => s.property),
			filters: buildFilters(),
		};
		if (edgeLabel !== ANY) {
			return { kind: "by-edge-type", body: { ...base, edge_label: edgeLabel } };
		}
		if (neighborLabel !== ANY) {
			return {
				kind: "by-node-type",
				body: { ...base, neighbor_label: neighborLabel },
			};
		}
		return { kind: "neighbors", body: base };
	}

	function buildFilters(): FilterGroup | null {
		const conditions: FilterExpression[] = filters
			.filter((f) => f.property)
			.map((f) => {
				const noValue = OPS.find((o) => o.value === f.op)?.noValue;
				return {
					property: f.property,
					op: f.op,
					value: noValue ? undefined : coerce(f.value),
				};
			});
		return conditions.length ? { operator: "and", conditions } : null;
	}

	async function load(mode: "reset" | "next") {
		const offset = mode === "reset" ? 0 : loaded;
		setBusy(true);
		try {
			const res = await onExpand(buildRequest(offset));
			if (res) {
				setTotal(res.total);
				setLoaded(offset + res.returned);
			}
		} finally {
			setBusy(false);
		}
	}

	const hasMore = total !== null && loaded < total;

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Fine-tune expand</DialogTitle>
					<DialogDescription>
						Load only the neighbours you need — by type, sorted and filtered, a
						page at a time.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="space-y-1.5">
						<Label>Direction</Label>
						<ToggleGroup
							type="single"
							value={direction}
							onValueChange={(v) => v && setDirection(v as ExpandDirection)}
						>
							<ToggleGroupItem value="in">Incoming</ToggleGroupItem>
							<ToggleGroupItem value="out">Outgoing</ToggleGroupItem>
							<ToggleGroupItem value="both">Both</ToggleGroupItem>
						</ToggleGroup>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Relationship type</Label>
							<Select value={edgeLabel} onValueChange={setEdgeLabel}>
								<SelectTrigger>
									<SelectValue placeholder="Any" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ANY}>Any</SelectItem>
									{(schema?.edgeTypes ?? []).map((et) => (
										<SelectItem key={et.name} value={et.name}>
											{et.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label>Neighbour type</Label>
							<Select value={neighborLabel} onValueChange={setNeighborLabel}>
								<SelectTrigger>
									<SelectValue placeholder="Any" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ANY}>Any</SelectItem>
									{(schema?.nodeTypes ?? []).map((nt) => (
										<SelectItem key={nt} value={nt}>
											{nt}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="pageSize">Page size</Label>
						<Input
							id="pageSize"
							className="w-32"
							type="number"
							min={1}
							max={500}
							value={pageSize}
							onChange={(e) =>
								setPageSize(
									Math.max(1, Math.min(500, Number(e.target.value) || 1)),
								)
							}
						/>
					</div>

					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<Label>Filters</Label>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() =>
									setFilters((f) => [
										...f,
										{ property: propertyKeys[0] ?? "", op: "eq", value: "" },
									])
								}
							>
								<Plus className="h-3.5 w-3.5" /> Add
							</Button>
						</div>
						{filters.map((row, i) => {
							const noValue = OPS.find((o) => o.value === row.op)?.noValue;
							return (
								// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and reorder-free
								<div key={i} className="flex items-center gap-2">
									<Select
										value={row.property}
										onValueChange={(v) =>
											setFilters((f) =>
												f.map((r, j) => (j === i ? { ...r, property: v } : r)),
											)
										}
									>
										<SelectTrigger className="flex-1">
											<SelectValue placeholder="Property" />
										</SelectTrigger>
										<SelectContent>
											{propertyKeys.map((p) => (
												<SelectItem key={p} value={p}>
													{p}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select
										value={row.op}
										onValueChange={(v) =>
											setFilters((f) =>
												f.map((r, j) =>
													j === i ? { ...r, op: v as FilterOp } : r,
												),
											)
										}
									>
										<SelectTrigger className="w-28">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{OPS.map((o) => (
												<SelectItem key={o.value} value={o.value}>
													{o.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Input
										className="flex-1"
										placeholder="Value"
										disabled={noValue}
										value={row.value}
										onChange={(e) =>
											setFilters((f) =>
												f.map((r, j) =>
													j === i ? { ...r, value: e.target.value } : r,
												),
											)
										}
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() =>
											setFilters((f) => f.filter((_, j) => j !== i))
										}
									>
										<X className="h-3.5 w-3.5" />
									</Button>
								</div>
							);
						})}
					</div>

					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<Label>Sort by</Label>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() =>
									setSorts((s) => [
										...s,
										{ property: propertyKeys[0] ?? "", direction: "asc" },
									])
								}
							>
								<Plus className="h-3.5 w-3.5" /> Add
							</Button>
						</div>
						{sorts.length > 1 && (
							<p className="text-xs text-muted-foreground">
								Applied in order — the first key takes priority, later keys
								break ties.
							</p>
						)}
						{sorts.map((row, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and order is the sort priority
							<div key={i} className="flex items-center gap-2">
								<Select
									value={row.property}
									onValueChange={(v) =>
										setSorts((s) =>
											s.map((r, j) => (j === i ? { ...r, property: v } : r)),
										)
									}
								>
									<SelectTrigger className="flex-1">
										<SelectValue placeholder="Property" />
									</SelectTrigger>
									<SelectContent>
										{propertyKeys.map((p) => (
											<SelectItem key={p} value={p}>
												{p}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<ToggleGroup
									type="single"
									value={row.direction}
									onValueChange={(v) =>
										v &&
										setSorts((s) =>
											s.map((r, j) =>
												j === i ? { ...r, direction: v as SortDirection } : r,
											),
										)
									}
								>
									<ToggleGroupItem value="asc">Asc</ToggleGroupItem>
									<ToggleGroupItem value="desc">Desc</ToggleGroupItem>
								</ToggleGroup>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onClick={() => setSorts((s) => s.filter((_, j) => j !== i))}
								>
									<X className="h-3.5 w-3.5" />
								</Button>
							</div>
						))}
					</div>
					{total !== null && (
						<p className="text-sm text-muted-foreground">
							Showing {loaded.toLocaleString()} of {total.toLocaleString()}{" "}
							neighbours
						</p>
					)}
				</div>

				<DialogFooter>
					<Button variant="ghost" type="button" onClick={onClose}>
						Close
					</Button>
					{hasMore && (
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={() => load("next")}
						>
							Load next page
						</Button>
					)}
					<Button type="button" disabled={busy} onClick={() => load("reset")}>
						Load
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
