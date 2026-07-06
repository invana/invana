import { Button, ScrollArea } from "@invana/ui";
import { X } from "lucide-react";
import type {
	CanvasStyling,
	EdgeTypeStyle,
	NodeTypeStyle,
} from "../../../../types/canvas";

// A node/edge type present on the canvas, with the property keys seen on its
// instances (offered as label-property choices).
export interface StyleTypeInfo {
	name: string;
	properties: string[];
}

interface Props {
	open: boolean;
	onClose: () => void;
	nodeTypes: StyleTypeInfo[];
	edgeTypes: StyleTypeInfo[];
	styling: CanvasStyling;
	/** Called with the full next styling on any edit (caller persists it). */
	onChange: (next: CanvasStyling) => void;
}

const DEFAULT_COLOR = "#9ca3af";

/**
 * Per node/edge-type styling controls (RFC-045): colour, label property and
 * size/width for each type currently on the canvas. Floats over the canvas like
 * the expand fine-tune panel; edits apply live and are persisted by the caller.
 */
export function StylingPanel({
	open,
	onClose,
	nodeTypes,
	edgeTypes,
	styling,
	onChange,
}: Props) {
	if (!open) return null;

	const setNode = (type: string, patch: Partial<NodeTypeStyle>) => {
		const nodeTypes = { ...(styling.nodeTypes ?? {}) };
		nodeTypes[type] = { ...nodeTypes[type], ...patch };
		onChange({ ...styling, nodeTypes });
	};
	const setEdge = (type: string, patch: Partial<EdgeTypeStyle>) => {
		const edgeTypes = { ...(styling.edgeTypes ?? {}) };
		edgeTypes[type] = { ...edgeTypes[type], ...patch };
		onChange({ ...styling, edgeTypes });
	};

	return (
		<div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-72 flex-col rounded-lg border border-border bg-background shadow-lg">
			<div className="flex items-center justify-between border-b border-border px-3 py-2">
				<span className="font-medium text-sm">Styling</span>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={onClose}
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
			<ScrollArea className="min-h-0 flex-1">
				<div className="space-y-4 p-3">
					{nodeTypes.length === 0 && edgeTypes.length === 0 && (
						<p className="text-center text-muted-foreground text-sm">
							Load some data, then style its node & edge types here.
						</p>
					)}
					{nodeTypes.length > 0 && (
						<section className="space-y-2">
							<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								Node types
							</p>
							{nodeTypes.map((t) => {
								const s = styling.nodeTypes?.[t.name] ?? {};
								return (
									<div
										key={t.name}
										className="space-y-1.5 rounded border border-border p-2"
									>
										<div className="flex items-center justify-between gap-2">
											<span className="min-w-0 truncate text-sm" title={t.name}>
												{t.name}
											</span>
											<input
												type="color"
												aria-label={`${t.name} colour`}
												className="h-6 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
												value={s.color ?? DEFAULT_COLOR}
												onChange={(e) =>
													setNode(t.name, { color: e.target.value })
												}
											/>
										</div>
										<div className="flex items-center gap-2">
											<select
												className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-xs"
												value={s.labelProperty ?? ""}
												onChange={(e) =>
													setNode(t.name, {
														labelProperty: e.target.value || undefined,
													})
												}
											>
												<option value="">Label: default</option>
												{t.properties.map((p) => (
													<option key={p} value={p}>
														Label: {p}
													</option>
												))}
											</select>
											<input
												type="number"
												min={4}
												max={64}
												placeholder="size"
												className="w-16 rounded border border-border bg-background px-1.5 py-1 text-xs"
												value={s.size ?? ""}
												onChange={(e) =>
													setNode(t.name, {
														size: e.target.value
															? Number(e.target.value)
															: undefined,
													})
												}
											/>
										</div>
									</div>
								);
							})}
						</section>
					)}
					{edgeTypes.length > 0 && (
						<section className="space-y-2">
							<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								Edge types
							</p>
							{edgeTypes.map((t) => {
								const s = styling.edgeTypes?.[t.name] ?? {};
								return (
									<div
										key={t.name}
										className="flex items-center gap-2 rounded border border-border p-2"
									>
										<span
											className="min-w-0 flex-1 truncate text-sm"
											title={t.name}
										>
											{t.name}
										</span>
										<input
											type="number"
											min={0.5}
											max={12}
											step={0.5}
											placeholder="width"
											className="w-16 rounded border border-border bg-background px-1.5 py-1 text-xs"
											value={s.width ?? ""}
											onChange={(e) =>
												setEdge(t.name, {
													width: e.target.value
														? Number(e.target.value)
														: undefined,
												})
											}
										/>
										<input
											type="color"
											aria-label={`${t.name} colour`}
											className="h-6 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
											value={s.color ?? DEFAULT_COLOR}
											onChange={(e) =>
												setEdge(t.name, { color: e.target.value })
											}
										/>
									</div>
								);
							})}
						</section>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
