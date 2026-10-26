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
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import {
	ApiError,
	suppressActionToast,
	useGraphConnectionQuery,
} from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useEffect, useState } from "react";
import {
	useCreatePropertyKeyMutation,
	useUpdateEdgeTypeMutation,
	useUpdateNodeTypeMutation,
} from "../../queries";
import type {
	PropertyKeyResponse,
	TypePropertyMappingCreate,
	TypePropertyMappingResponse,
} from "../../types";
import { propertyTypeOptions } from "../propertyTypes";
import type { ModelEditCtx } from "../types";

const CARDINALITIES = ["SINGLE", "LIST", "SET"] as const;

/** The type's current mappings as a create-list — a type is patched by replacing them. */
export function mappingsAsCreate(
	mappings: TypePropertyMappingResponse[],
): TypePropertyMappingCreate[] {
	return mappings.map((m) => ({
		property_key: m.property_key.name,
		default_value: m.default_value,
		sort_order: m.sort_order,
		validation_rules: m.validation_rules.map((r) => ({
			rule_type: r.rule_type,
			params: r.params,
		})),
	}));
}

interface Props {
	open: boolean;
	ctx: ModelEditCtx;
	kind: "node" | "edge";
	typeId: string;
	/** The type's own mappings — the property is appended to them. */
	mappings: TypePropertyMappingResponse[];
	/** Every property key of the version; a name that matches one is reused. */
	propertyKeys: PropertyKeyResponse[];
	onClose: () => void;
}

/**
 * *Add property* on a type's page: a name, a data type and a cardinality.
 * A name that already exists in the version attaches that shared key; a new one
 * creates the key first, then patches this type's mappings.
 */
export function PropertyFormDialog({
	open,
	ctx,
	kind,
	typeId,
	mappings,
	propertyKeys,
	onClose,
}: Props) {
	const createKey = useCreatePropertyKeyMutation(ctx.username, ctx.graphSlug);
	const updateNode = useUpdateNodeTypeMutation(ctx.username, ctx.graphSlug);
	const updateEdge = useUpdateEdgeTypeMutation(ctx.username, ctx.graphSlug);
	const connection = useGraphConnectionQuery(ctx.username, ctx.graphSlug);
	const typeOptions = propertyTypeOptions(
		connection.data?.supported_property_types,
	);

	const [name, setName] = useState("");
	const [type, setType] = useState("string");
	const [cardinality, setCardinality] = useState<string>("SINGLE");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setName("");
		setType("string");
		setCardinality("SINGLE");
		setError(null);
	}, [open]);

	const busy =
		createKey.isPending || updateNode.isPending || updateEdge.isPending;

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		const key = name.trim();
		if (!key) return;
		if (mappings.some((m) => m.property_key.name === key)) {
			setError("That property is already on this type.");
			return;
		}
		setError(null);
		try {
			// Two requests, one staged change: the toast waits for neither.
			await suppressActionToast(async () => {
				if (!propertyKeys.some((p) => p.name === key))
					await createKey.mutateAsync({
						modelId: ctx.modelId,
						versionId: ctx.versionId,
						data: {
							name: key,
							type,
							value_cardinality: cardinality as "SINGLE" | "LIST" | "SET",
						},
					});
				const args = {
					modelId: ctx.modelId,
					versionId: ctx.versionId,
					typeId,
					data: {
						property_mappings: [
							...mappingsAsCreate(mappings),
							{ property_key: key, sort_order: mappings.length },
						],
					},
				};
				if (kind === "node") await updateNode.mutateAsync(args);
				else await updateEdge.mutateAsync(args);
			});
			onClose();
		} catch (err) {
			setError(
				err instanceof ApiError ? err.message : "Failed to add the property.",
			);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<form onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Add property</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 pt-4">
						<div className="space-y-2">
							<Label htmlFor="propName">Name</Label>
							<Input
								id="propName"
								required
								autoFocus
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="propType">Data type</Label>
							<Select value={type} onValueChange={setType}>
								<SelectTrigger id="propType">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{typeOptions.map((t) => (
										<SelectItem key={t} value={t}>
											{t}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="propCard">Cardinality</Label>
							<Select value={cardinality} onValueChange={setCardinality}>
								<SelectTrigger id="propCard">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{CARDINALITIES.map((c) => (
										<SelectItem key={c} value={c}>
											{c}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<FormError error={error} className="mt-4" />
					<DialogFooter>
						<Button variant="ghost" type="button" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={busy || !name.trim()}>
							{busy ? "Adding…" : "Add property"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
