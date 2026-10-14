/**
 * **Bind to a Graph** (board `datasets.bind`, DS-11): one exact version of the
 * dataset into a model of a Graph the person belongs to, as a node type.
 *
 * The table says what will happen to each column before anything runs: the
 * key column becomes the node's `id`, a column with a property of the same
 * name on the type fills it, and the rest are named as not in the type. A bind
 * is an ordinary load run — submitting opens it, and *Open the run* follows it
 * on its Graph's Activity. The Graph stays on this version until someone binds
 * another; a retracted version is refused, naming why.
 */

import {
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Alert,
	AlertDescription,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	StatusDot,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { activityPath } from "@invana-studio/shell";
import { FormError } from "@invana-studio/ui";
import { Link2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	useBind,
	useBindTargets,
	useModelsQuery,
	useModelTypesQuery,
	useVersionsQuery,
} from "../queries";
import type { Dataset } from "../types";

export function BindDialog({
	dataset,
	open,
	onClose,
}: {
	dataset: Dataset;
	open: boolean;
	onClose: () => void;
}) {
	const navigate = useNavigate();
	const graphs = useBindTargets();
	const [graphKey, setGraphKey] = useState("");
	const [modelId, setModelId] = useState("");
	const [type, setType] = useState("");
	const [username = "", graphSlug = ""] = graphKey.split("/");
	const models = useModelsQuery(username, graphSlug);
	const types = useModelTypesQuery(username, graphSlug, modelId);
	const versions = useVersionsQuery(dataset);
	const bind = useBind();
	const version = dataset.current_version;
	const columns =
		versions.data?.items.find((v) => v.version === version)?.columns ?? [];
	const nodeType = types.data?.node_types.find((t) => t.name === type);
	const properties = new Set(
		(nodeType?.effective_property_mappings ?? []).map(
			(m) => m.property_key.name,
		),
	);
	const bound = bind.data;

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Bind to a Graph</DialogTitle>
					<DialogDescription>
						{dataset.title || dataset.name} · v{version}
					</DialogDescription>
				</DialogHeader>

				{bound ? (
					<Alert tone="success">
						<AlertDescription>
							{bound.address} is loading into {bound.model_name} as{" "}
							{bound.type_name}. The Graph stays on v{bound.version} until
							someone binds another.
							{bound.warnings?.length ? ` ${bound.warnings.join(" ")}` : ""}
						</AlertDescription>
					</Alert>
				) : (
					<div className="flex flex-col gap-3">
						<div className="grid grid-cols-2 gap-3">
							<div className="flex flex-col gap-1.5">
								<Label>Graph</Label>
								<Select
									value={graphKey}
									onValueChange={(v) => {
										setGraphKey(v);
										setModelId("");
										setType("");
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="A Graph you belong to" />
									</SelectTrigger>
									<SelectContent>
										{(graphs.data?.items ?? []).map((g) => (
											<SelectItem
												key={g.id}
												value={`${g.owner_username}/${g.slug}`}
											>
												{g.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Model and type</Label>
								<Select
									value={modelId && type ? `${modelId}/${type}` : ""}
									disabled={!graphKey}
									onValueChange={(v) => {
										const [m = "", t = ""] = v.split("/");
										setModelId(m);
										setType(t);
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="A node type" />
									</SelectTrigger>
									<SelectContent>
										{(models.data ?? [])
											.filter((m) => m.active_version)
											.map((m) => (
												<ModelTypes
													key={m.id}
													username={username}
													graphSlug={graphSlug}
													modelId={m.id}
													modelName={m.name}
												/>
											))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{type ? (
							<div className="flex flex-col gap-1.5">
								<Label>Columns → properties</Label>
								<Table density="compact">
									<TableHeader>
										<TableRow>
											<TableHead>Column</TableHead>
											<TableHead>Property</TableHead>
											<TableHead>Check</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{columns.map((c) => {
											const key = c === dataset.key_column;
											const fits = key || properties.has(c);
											return (
												<TableRow key={c}>
													<TableCell className="font-mono">{c}</TableCell>
													<TableCell className="font-mono">
														{key ? `${type}.id` : fits ? `${type}.${c}` : "—"}
													</TableCell>
													<TableCell>
														<span className="inline-flex items-center gap-1.5">
															<StatusDot tone={fits ? "success" : "warning"} />
															{key
																? "key"
																: fits
																	? "property"
																	: "not in the type"}
														</span>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>
						) : null}
						<FormError error={bind.error} />
					</div>
				)}

				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						{bound ? "Close" : "Cancel"}
					</Button>
					{bound?.run_id ? (
						<Button
							onClick={() =>
								navigate(
									activityPath(
										{ username, graphSlug },
										"runs",
										bound.run_id as string,
									),
								)
							}
						>
							Open the run
						</Button>
					) : (
						<Button
							disabled={!type || version === null || bind.isPending}
							onClick={() =>
								bind.mutate({
									username,
									graphSlug,
									dataset: `${dataset.address}@${version}`,
									model: modelId,
									type,
								})
							}
						>
							<Link2 />
							Bind v{version}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** One model's node types, as the options of the type picker. */
function ModelTypes({
	username,
	graphSlug,
	modelId,
	modelName,
}: {
	username: string;
	graphSlug: string;
	modelId: string;
	modelName: string;
}) {
	const types = useModelTypesQuery(username, graphSlug, modelId);
	return (
		<>
			{(types.data?.node_types ?? [])
				.filter((t) => !t.is_abstract)
				.map((t) => (
					<SelectItem key={t.name} value={`${modelId}/${t.name}`}>
						{modelName} · {t.name}
					</SelectItem>
				))}
		</>
	);
}
