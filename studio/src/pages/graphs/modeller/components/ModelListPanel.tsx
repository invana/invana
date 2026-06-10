import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	ScrollArea,
	TabbedPanel,
} from "@invana/ui";
import {
	Box,
	Boxes,
	ChevronRight,
	MoreVertical,
	Plus,
	RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDeleteModelMutation } from "../../../../hooks/queries/useModels";
import { ApiError } from "../../../../services/api/client";
import type { GraphModelSummary } from "../../../../types/models";

interface Props {
	models: GraphModelSummary[];
	onSelect: (modelId: string) => void;
	username: string;
	graphSlug: string;
	onNewModel: () => void;
	onEditModel: (model: GraphModelSummary) => void;
	onIntrospect: () => void;
	introspecting: boolean;
}

const fmtDate = (iso: string) =>
	new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

/** Secondary meta line: when it was published + last updated. */
function modelMeta(m: GraphModelSummary): string {
	const updated = `Updated ${fmtDate(m.updated_at)}`;
	if (m.origin === "introspected") {
		return m.active_version?.activated_at
			? `Synced ${fmtDate(m.active_version.activated_at)}`
			: updated;
	}
	if (m.active_version?.activated_at) {
		return `Published · ${updated}`;
	}
	return `Draft · ${updated}`;
}

export function ModelListPanel({
	models,
	onSelect,
	username,
	graphSlug,
	onNewModel,
	onEditModel,
	onIntrospect,
	introspecting,
}: Props) {
	const del = useDeleteModelMutation(username, graphSlug);
	const [deleting, setDeleting] = useState<GraphModelSummary | null>(null);

	async function onConfirmDelete() {
		if (!deleting) return;
		try {
			await del.mutateAsync(deleting.id);
			toast.success("Model deleted.");
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : "Failed to delete.");
		} finally {
			setDeleting(null);
		}
	}

	const body = (
		<div className="flex h-full flex-col">
			<ScrollArea className="flex-1">
				{models.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
						<p>No graph models yet.</p>
						<p className="text-xs">
							Click <RefreshCw className="inline w-3 h-3" /> to introspect the
							database into a read-only{" "}
							<span className="font-medium">global</span> model, or{" "}
							<span className="font-medium">+ New</span> to author one.
						</p>
					</div>
				) : (
					<div className="flex flex-col py-1">
						{models.map((m) => (
							<div
								key={m.id}
								className="group flex items-center gap-1 pr-1 hover:bg-accent/50 transition-colors"
							>
								<button
									type="button"
									onClick={() => onSelect(m.id)}
									className="flex flex-1 items-center justify-between gap-2 px-3 py-2 text-left min-w-0"
								>
									<Box className="w-4 h-4 text-muted-foreground shrink-0 self-start mt-0.5" />
									<div className="min-w-0 flex-1">
										<div className="font-medium truncate flex items-center gap-1">
											{m.name}
											{m.origin === "introspected" && (
												<Badge variant="secondary" className="text-[10px]">
													global
												</Badge>
											)}
										</div>
										<div className="text-xs text-muted-foreground truncate">
											{m.description ||
												(m.origin === "introspected"
													? "live database schema"
													: "—")}
										</div>
										<div className="text-[11px] text-muted-foreground/80 truncate">
											{modelMeta(m)}
										</div>
									</div>
									<ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
								</button>
								{/* The system "global" model is read-only — no rename/delete/set-default. */}
								{m.origin !== "introspected" && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="opacity-0 group-hover:opacity-100"
											>
												<MoreVertical className="w-4 h-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onClick={() => onEditModel(m)}>
												Rename / edit
											</DropdownMenuItem>
											<DropdownMenuItem
												className="text-destructive"
												onClick={() => setDeleting(m)}
											>
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</div>
						))}
					</div>
				)}
			</ScrollArea>
		</div>
	);

	return (
		<>
			<TabbedPanel
				defaultTab="models"
				tabs={[
					{ value: "models", label: "Models", icon: Boxes, content: body },
				]}
				headerActions={{
					rightNavItems: [
						{
							key: "introspect",
							name: introspecting ? "Introspecting…" : "Introspect",
							icon: RefreshCw,
							iconClassName: introspecting ? "animate-spin" : undefined,
							onClick: onIntrospect,
						},
						{
							key: "new",
							name: "New model",
							icon: Plus,
							onClick: onNewModel,
						},
					],
				}}
			/>

			<AlertDialog
				open={deleting !== null}
				onOpenChange={(o) => !o && setDeleting(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete model?</AlertDialogTitle>
						<AlertDialogDescription>
							Delete "{deleting?.name}" and all its versions? This cannot be
							undone.
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
		</>
	);
}
