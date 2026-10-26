import {
	Checkbox,
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
import { ApiError, suppressActionToast } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useEffect, useState } from "react";
import {
	useCreateConstraintMutation,
	useCreateIndexMutation,
} from "../../queries";
import type { ConstraintCreate, IndexCreate } from "../../types";
import type { ModelEditCtx } from "../types";

const INDEX_TYPES: NonNullable<IndexCreate["index_type"]>[] = [
	"range",
	"composite",
	"fulltext",
	"text",
	"point",
	"lookup",
];
const NODE_CONSTRAINTS: ConstraintCreate["constraint_type"][] = [
	"unique",
	"exists",
	"node_key",
];
const EDGE_CONSTRAINTS: ConstraintCreate["constraint_type"][] = [
	"relationship_unique",
	"relationship_exists",
];

interface Props {
	open: boolean;
	ctx: ModelEditCtx;
	/** Which rule the form declares. */
	rule: "index" | "constraint";
	/** The type the rule sits on. */
	target: { kind: "node_type" | "edge_type"; name: string };
	/** The type's property names — a rule is on some of them. */
	properties: string[];
	onClose: () => void;
}

/**
 * *Add index* and *Add constraint* on a type's page — one form, because the
 * two differ only in the kind of rule they pick: a name, that kind, and the
 * properties of the type it covers. It stages on the open draft.
 */
export function RuleFormDialog({
	open,
	ctx,
	rule,
	target,
	properties,
	onClose,
}: Props) {
	const createIndex = useCreateIndexMutation(ctx.username, ctx.graphSlug);
	const createConstraint = useCreateConstraintMutation(
		ctx.username,
		ctx.graphSlug,
	);
	const kinds: string[] =
		rule === "index"
			? INDEX_TYPES
			: target.kind === "node_type"
				? NODE_CONSTRAINTS
				: EDGE_CONSTRAINTS;

	const [name, setName] = useState("");
	const [kind, setKind] = useState(kinds[0]);
	const [picked, setPicked] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setName("");
		setKind(kinds[0]);
		setPicked([]);
		setError(null);
	}, [open, kinds[0]]);

	const busy = createIndex.isPending || createConstraint.isPending;

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim() || picked.length === 0) return;
		setError(null);
		const base = {
			modelId: ctx.modelId,
			versionId: ctx.versionId,
		};
		const common = {
			name: name.trim(),
			target_kind: target.kind,
			target_label: target.name,
			properties: picked,
		};
		try {
			await suppressActionToast(async () => {
				if (rule === "index")
					await createIndex.mutateAsync({
						...base,
						data: {
							...common,
							index_type: kind as NonNullable<IndexCreate["index_type"]>,
						},
					});
				else
					await createConstraint.mutateAsync({
						...base,
						data: {
							...common,
							constraint_type: kind as ConstraintCreate["constraint_type"],
						},
					});
			});
			onClose();
		} catch (err) {
			setError(
				err instanceof ApiError ? err.message : `Failed to add the ${rule}.`,
			);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<form onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>
							{rule === "index" ? "Add index" : "Add constraint"} on{" "}
							{target.name}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 pt-4">
						<div className="space-y-2">
							<Label htmlFor="ruleName">Name</Label>
							<Input
								id="ruleName"
								required
								autoFocus
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="ruleKind">
								{rule === "index" ? "Index type" : "Constraint type"}
							</Label>
							<Select value={kind} onValueChange={setKind}>
								<SelectTrigger id="ruleKind">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{kinds.map((k) => (
										<SelectItem key={k} value={k}>
											{k}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Properties</Label>
							{properties.length === 0 ? (
								<p className="text-muted-foreground">
									This type has no properties yet.
								</p>
							) : (
								properties.map((p) => (
									<div key={p} className="flex items-center gap-2">
										<Checkbox
											id={`rule-${p}`}
											checked={picked.includes(p)}
											onCheckedChange={(c) =>
												setPicked((cur) =>
													c === true ? [...cur, p] : cur.filter((x) => x !== p),
												)
											}
										/>
										<Label htmlFor={`rule-${p}`} className="font-mono">
											{p}
										</Label>
									</div>
								))
							)}
						</div>
					</div>
					<FormError error={error} className="mt-4" />
					<DialogFooter>
						<Button variant="ghost" type="button" onClick={onClose}>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={busy || !name.trim() || picked.length === 0}
						>
							{busy
								? "Adding…"
								: rule === "index"
									? "Add index"
									: "Add constraint"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
