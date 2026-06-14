import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDeletePropertyKeyMutation } from "../../../../hooks/queries/useModels";
import { ApiError } from "../../../../services/api/client";
import type {
	EdgeTypeResponse,
	NodeTypeResponse,
	PropertyKeyResponse,
} from "../../../../types/schemas";
import { PropertyKeyFormDialog } from "./PropertyKeyFormDialog";
import type { ModelEditCtx } from "./editing";

interface Props {
	propertyKeys: PropertyKeyResponse[];
	nodeTypes: NodeTypeResponse[];
	edgeTypes: EdgeTypeResponse[];
	editable?: boolean;
	ctx?: ModelEditCtx;
}

export function PropertyKeyTable({
	propertyKeys,
	nodeTypes,
	edgeTypes,
	editable = false,
	ctx,
}: Props) {
	const del = useDeletePropertyKeyMutation(
		ctx?.username ?? "",
		ctx?.graphSlug ?? "",
	);
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState<PropertyKeyResponse | null>(null);
	const [deleting, setDeleting] = useState<PropertyKeyResponse | null>(null);

	// Compute "Used by" client-side from all type mappings.
	const usedByList = (keyName: string): string[] => {
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
		return labels;
	};

	async function onConfirmDelete() {
		if (!deleting || !ctx) return;
		try {
			await del.mutateAsync({
				modelId: ctx.modelId,
				versionId: ctx.versionId,
				keyId: deleting.id,
			});
		} catch (err) {
			toast.error(
				err instanceof ApiError
					? err.message
					: "Failed to delete property key.",
			);
		} finally {
			setDeleting(null);
		}
	}

	return (
		<div className="flex flex-col gap-2">
			{editable && ctx && (
				<div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setEditing(null);
							setFormOpen(true);
						}}
					>
						<Plus className="w-3.5 h-3.5 mr-1" />
						New property key
					</Button>
				</div>
			)}

			{propertyKeys.length === 0 ? (
				<p className="text-muted-foreground py-2">No property keys defined.</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Cardinality</TableHead>
							<TableHead>Used by</TableHead>
							{editable && <TableHead className="w-20 text-right" />}
						</TableRow>
					</TableHeader>
					<TableBody>
						{propertyKeys.map((pk) => {
							const used = usedByList(pk.name);
							return (
								<TableRow key={pk.id}>
									<TableCell className="font-mono">{pk.name}</TableCell>
									<TableCell>{pk.type}</TableCell>
									<TableCell>{pk.value_cardinality}</TableCell>
									<TableCell className="text-muted-foreground">
										{used.length > 0 ? used.join(", ") : "—"}
									</TableCell>
									{editable && ctx && (
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="sm"
												title="Edit"
												onClick={() => {
													setEditing(pk);
													setFormOpen(true);
												}}
											>
												<Pencil className="w-3.5 h-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												title="Delete"
												onClick={() => setDeleting(pk)}
											>
												<Trash2 className="w-3.5 h-3.5" />
											</Button>
										</TableCell>
									)}
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			)}

			{ctx && (
				<PropertyKeyFormDialog
					open={formOpen}
					ctx={ctx}
					propertyKey={editing}
					usedByCount={editing ? usedByList(editing.name).length : 0}
					onClose={() => setFormOpen(false)}
				/>
			)}

			<AlertDialog
				open={deleting !== null}
				onOpenChange={(o) => !o && setDeleting(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete property key?</AlertDialogTitle>
						<AlertDialogDescription>
							{deleting && usedByList(deleting.name).length > 0
								? `"${deleting.name}" is used by ${usedByList(deleting.name).join(", ")}. Deleting it removes the property from those types too.`
								: `Delete "${deleting?.name}"? This cannot be undone.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={onConfirmDelete}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
