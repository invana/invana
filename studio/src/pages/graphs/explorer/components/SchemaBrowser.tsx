import { TabbedPanel } from "@invana/ui";
import { ListTree, PanelLeftClose, Workflow } from "lucide-react";
import type { GraphVersionResponse } from "../../../../types/schemas";
// Reuse the Modeller's read-only schema canvas (the `ExploreSchemaCanvas` path,
// taken when no editing `ctx` is passed) so the graph rendering lives in one
// place — no duplicate PixiJS/canvas wiring, and the Modeller is left untouched.
import { SchemaCanvas } from "../../modeller/components/SchemaCanvas";
import type { CanvasBackend } from "./ExplorerCanvas";
import { SchemaOverview } from "./SchemaOverview";

interface Props {
	version: GraphVersionResponse | undefined;
	isLoading?: boolean;
	/** PixiJS backend for the canvas tab (mirrors the user's Explorer choice). */
	backend?: CanvasBackend;
	/** Collapse the panel (closes the shared `?settings=model` rail key). */
	onClose?: () => void;
}

const noop = () => {};

// The Explorer's read-only model browser, docked in the left rail under
// `?settings=model`. Two tabs over the same active schema version: an "Overview"
// file-manager tree (types → properties/indexes/constraints) and a "Canvas" that
// renders the schema as a graph. View-only — all authoring stays in the Modeller.
export function SchemaBrowser({ version, isLoading, backend, onClose }: Props) {
	const nodeTypes = version?.node_types ?? [];
	const edgeTypes = version?.edge_types ?? [];
	const hasModel = nodeTypes.length > 0 || edgeTypes.length > 0;

	// The canvas tab renders the schema graph; when there's no model yet, keep the
	// same empty copy as the overview rather than the Modeller's introspect hint.
	const canvasContent =
		isLoading || hasModel ? (
			<SchemaCanvas
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				selected={null}
				onSelect={noop}
				backend={backend}
			/>
		) : (
			<div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
				<Workflow className="h-6 w-6" />
				<p className="text-sm">No model yet</p>
				<p className="text-xs">
					This graph has no published model. Define one in the Modeller.
				</p>
			</div>
		);

	return (
		<TabbedPanel
			defaultTab="overview"
			tabs={[
				{
					value: "overview",
					label: "Overview",
					icon: ListTree,
					content: <SchemaOverview version={version} isLoading={isLoading} />,
				},
				{
					value: "canvas",
					label: "Canvas",
					icon: Workflow,
					content: canvasContent,
				},
			]}
			headerActions={{
				rightNavItems: onClose
					? [
							{
								key: "close",
								name: "Collapse panel",
								icon: PanelLeftClose,
								onClick: onClose,
							},
						]
					: [],
			}}
		/>
	);
}
