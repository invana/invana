import { Badge, ScrollArea, Skeleton } from "@invana/ui";
import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Layers,
	Loader2,
} from "lucide-react";
import { useState } from "react";
import {
	useDatasetJobsQuery,
	useDatasetsQuery,
	useImportJobQuery,
} from "../../../hooks/queries/useDatasets";
import type {
	DatasetSummary,
	ImportJobSummary,
	JobStatus,
	RecordCounts,
} from "../../../types/datasets";

interface Props {
	username: string;
	graphSlug: string;
}

function countLabel(rc: RecordCounts): string {
	const n = Object.values(rc.nodes ?? {}).reduce((a, b) => a + b, 0);
	const e = Object.values(rc.edges ?? {}).reduce((a, b) => a + b, 0);
	return `${n} node${n === 1 ? "" : "s"} · ${e} edge${e === 1 ? "" : "s"}`;
}

const STATUS_VARIANT: Record<
	JobStatus,
	"default" | "secondary" | "destructive" | "outline"
> = {
	succeeded: "default",
	running: "secondary",
	failed: "destructive",
	queued: "outline",
	cancelled: "outline",
};

function JobStatusBadge({ status }: { status: JobStatus | null }) {
	if (!status) {
		return (
			<Badge variant="outline" className="text-xs">
				no runs
			</Badge>
		);
	}
	return (
		<Badge variant={STATUS_VARIANT[status]} className="text-xs">
			{status === "running" && (
				<Loader2 className="w-3 h-3 mr-1 animate-spin" />
			)}
			{status === "succeeded" && <CheckCircle2 className="w-3 h-3 mr-1" />}
			{status === "failed" && <AlertCircle className="w-3 h-3 mr-1" />}
			{status}
		</Badge>
	);
}

export function DatasetsSection({ username, graphSlug }: Props) {
	const { data, isLoading } = useDatasetsQuery(username, graphSlug);
	const [selected, setSelected] = useState<DatasetSummary | null>(null);

	if (isLoading) {
		return (
			<div className="space-y-2">
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-12 w-full" />
			</div>
		);
	}

	if (selected) {
		return (
			<DatasetDetail
				username={username}
				graphSlug={graphSlug}
				dataset={selected}
				onBack={() => setSelected(null)}
			/>
		);
	}

	const items = data ?? [];
	if (items.length === 0) {
		return (
			<div className="border border-border rounded-lg p-8 flex flex-col items-center gap-3 text-center">
				<Layers className="w-8 h-8 text-muted-foreground opacity-50" />
				<p className="text-muted-foreground">No datasets yet.</p>
				<p className="text-xs text-muted-foreground">
					Import one with{" "}
					<code className="font-mono">
						invana datasets import --graph {username}/{graphSlug} --name
						&lt;name&gt; --path &lt;dir&gt;
					</code>
				</p>
			</div>
		);
	}

	return (
		<div className="border border-border rounded-lg divide-y divide-border">
			{items.map((d) => (
				<button
					type="button"
					key={d.id}
					onClick={() => setSelected(d)}
					className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
				>
					<div className="flex-1 min-w-0">
						<div className="font-medium truncate">{d.name}</div>
						<div className="text-xs text-muted-foreground">
							{countLabel(d.record_counts)}
						</div>
					</div>
					<JobStatusBadge status={d.latest_status} />
					<ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
				</button>
			))}
		</div>
	);
}

function DatasetDetail({
	username,
	graphSlug,
	dataset,
	onBack,
}: Props & { dataset: DatasetSummary; onBack: () => void }) {
	const { data: jobs, isLoading } = useDatasetJobsQuery(
		username,
		graphSlug,
		dataset.id,
	);

	return (
		<div className="space-y-3">
			<button
				type="button"
				onClick={onBack}
				className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
			>
				<ChevronLeft className="w-3 h-3" />
				All datasets
			</button>
			<div>
				<div className="font-semibold">{dataset.name}</div>
				<div className="text-xs text-muted-foreground">
					{countLabel(dataset.record_counts)}
				</div>
			</div>

			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
				Import jobs
			</p>
			{isLoading ? (
				<Skeleton className="h-12 w-full" />
			) : (jobs ?? []).length === 0 ? (
				<p className="text-muted-foreground text-sm">No import runs yet.</p>
			) : (
				<ul className="space-y-1.5">
					{(jobs ?? []).map((j) => (
						<JobRow
							key={j.id}
							username={username}
							graphSlug={graphSlug}
							datasetId={dataset.id}
							job={j}
						/>
					))}
				</ul>
			)}
		</div>
	);
}

function JobRow({
	username,
	graphSlug,
	datasetId,
	job,
}: Props & { datasetId: string; job: ImportJobSummary }) {
	const [open, setOpen] = useState(false);
	const { data: full, isLoading } = useImportJobQuery(
		username,
		graphSlug,
		datasetId,
		open ? job.id : undefined,
	);

	return (
		<li className="border border-border rounded-md">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
			>
				{open ? (
					<ChevronDown className="w-3 h-3" />
				) : (
					<ChevronRight className="w-3 h-3" />
				)}
				<JobStatusBadge status={job.status} />
				<span className="text-xs text-muted-foreground">
					{new Date(job.created_at).toLocaleString()}
				</span>
				<span className="ml-auto text-xs text-muted-foreground">
					{job.records_processed}/{job.records_total} · {job.error_count} err
				</span>
			</button>
			{open && (
				<div className="border-t border-border px-2.5 py-2 space-y-3 bg-muted/20">
					{isLoading || !full ? (
						<Skeleton className="h-4 w-2/3" />
					) : (
						<>
							{full.report?.fatal && (
								<p className="text-destructive text-xs">
									Failed: {full.report.fatal}
								</p>
							)}
							<div>
								<p className="text-xs font-medium mb-1">Validation</p>
								{full.report?.errors?.length ? (
									<ul className="space-y-0.5 text-xs text-destructive">
										{full.report.errors.map((e, i) => (
											<li key={`${e.file}-${e.record_index}-${i}`}>
												{e.file}[{e.record_index}] id={String(e.record_id)}:{" "}
												{e.message}
											</li>
										))}
									</ul>
								) : (
									<p className="text-xs text-muted-foreground">
										No validation errors.
									</p>
								)}
							</div>
							<div>
								<p className="text-xs font-medium mb-1">Logs</p>
								<ScrollArea className="max-h-48">
									<div className="font-mono text-xs space-y-0.5">
										{full.logs.map((l, i) => (
											<div key={`${l.stage}-${i}`} className="flex gap-2">
												<span className="text-muted-foreground shrink-0">
													{l.stage}
												</span>
												<span
													className={
														l.level === "error" ? "text-destructive" : ""
													}
												>
													{l.message}
												</span>
											</div>
										))}
									</div>
								</ScrollArea>
							</div>
						</>
					)}
				</div>
			)}
		</li>
	);
}
