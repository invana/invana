import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
	useDeleteGraphMutation,
	useGraphsQuery,
	useReconnectGraphMutation,
} from "../../hooks/queries/useGraphs";
import type { GraphRead } from "../../types/graphs";
import { CONNECTOR_OPTIONS } from "../../types/graphs";
import { GraphStatusBadge } from "./components/GraphStatusBadge";

function connectorLabel(connectorClass: string): string {
	return (
		CONNECTOR_OPTIONS.find((o) => o.value === connectorClass)?.label ??
		connectorClass
	);
}

function formatLatency(ms: number | null): string {
	if (ms === null) return "—";
	return `${ms} ms`;
}

function formatDate(iso: string | null): string {
	if (!iso) return "—";
	return new Date(iso).toLocaleString();
}

export function GraphsListPage() {
	const navigate = useNavigate();
	const { data, isLoading, isError, error } = useGraphsQuery();
	const deleteMutation = useDeleteGraphMutation();
	const reconnectMutation = useReconnectGraphMutation();
	const [deleteTarget, setDeleteTarget] = useState<GraphRead | null>(null);

	const handleDelete = () => {
		if (!deleteTarget) return;
		deleteMutation.mutate(deleteTarget.id, {
			onSuccess: () => {
				toast.success(`"${deleteTarget.name}" deleted`);
				setDeleteTarget(null);
			},
			onError: (err) => {
				toast.error(err.message);
				setDeleteTarget(null);
			},
		});
	};

	const handleReconnect = (graph: GraphRead) => {
		reconnectMutation.mutate(graph.id, {
			onSuccess: () => toast.success(`Reconnecting "${graph.name}"…`),
			onError: (err) => toast.error(err.message),
		});
	};

	return (
		<div className="flex flex-col h-full">
			{/* Page header */}
			<div className="flex items-center justify-between px-6 py-4 border-b">
				<div>
					<h1 className="text-lg font-semibold">Graph Connections</h1>
					<p className="text-sm text-muted-foreground">
						Manage connections to your graph databases
					</p>
				</div>
				<Button onClick={() => navigate("/graphs/new")}>
					<Plus className="h-4 w-4 mr-2" />
					New Connection
				</Button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-auto px-6 py-4">
				{isLoading && (
					<div className="space-y-2">
						{["s1", "s2", "s3"].map((k) => (
							<Skeleton key={k} className="h-10 w-full" />
						))}
					</div>
				)}

				{isError && (
					<div className="flex flex-col items-center justify-center h-48 gap-2">
						<p className="text-sm text-destructive">
							{error instanceof Error ? error.message : "Failed to load graphs"}
						</p>
					</div>
				)}

				{!isLoading && !isError && data?.items.length === 0 && (
					<div className="flex flex-col items-center justify-center h-48 gap-3">
						<p className="text-muted-foreground text-sm">
							No graph connections yet
						</p>
						<Button variant="outline" onClick={() => navigate("/graphs/new")}>
							<Plus className="h-4 w-4 mr-2" />
							Connect your first graph database
						</Button>
					</div>
				)}

				{!isLoading && !isError && data && data.items.length > 0 && (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Connector</TableHead>
								<TableHead>URI</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Latency</TableHead>
								<TableHead>Last Health Check</TableHead>
								<TableHead className="w-10" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.items.map((graph) => (
								<TableRow
									key={graph.id}
									className="cursor-pointer"
									onClick={() => navigate(`/graphs/${graph.id}/modeller`)}
								>
									<TableCell className="font-medium">{graph.name}</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{connectorLabel(graph.connector_class)}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm font-mono">
										{graph.uri}
									</TableCell>
									<TableCell>
										<GraphStatusBadge status={graph.status} />
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{formatLatency(graph.latency_ms)}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{formatDate(graph.last_health_check_at)}
									</TableCell>
									<TableCell onClick={(e) => e.stopPropagation()}>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="icon" className="h-7 w-7">
													<MoreHorizontal className="h-4 w-4" />
													<span className="sr-only">Actions</span>
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													onClick={() => navigate(`/graphs/${graph.id}/edit`)}
												>
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => handleReconnect(graph)}
													disabled={reconnectMutation.isPending}
												>
													<RefreshCw className="h-3.5 w-3.5 mr-2" />
													Reconnect
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="text-destructive focus:text-destructive"
													onClick={() => setDeleteTarget(graph)}
												>
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</div>

			{/* Delete confirmation dialog */}
			<Dialog
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Delete &ldquo;{deleteTarget?.name}&rdquo;?
						</DialogTitle>
						<DialogDescription>
							This will remove the connection record. The graph database itself
							will not be affected. This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteTarget(null)}
							disabled={deleteMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending ? "Deleting…" : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
