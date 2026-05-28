// Datasets + import jobs (RFC-020, view-only).

export type JobStatus =
	| "queued"
	| "running"
	| "succeeded"
	| "failed"
	| "cancelled";

export interface RecordCounts {
	nodes?: Record<string, number>;
	edges?: Record<string, number>;
}

export interface ImportJobSummary {
	id: string;
	status: JobStatus;
	model_version_id: string | null;
	records_total: number;
	records_processed: number;
	error_count: number;
	warning_count: number;
	started_at: string | null;
	finished_at: string | null;
	created_at: string;
}

export interface ReportError {
	file?: string;
	record_index?: number;
	record_id?: string | null;
	field?: string;
	rule?: string;
	message?: string;
}

export interface LogLine {
	ts: string;
	level: string;
	stage: string;
	message: string;
}

export interface ImportJobResponse extends ImportJobSummary {
	report: { errors?: ReportError[]; fatal?: string };
	logs: LogLine[];
}

export interface DatasetSummary {
	id: string;
	graph_id: string;
	model_id: string | null;
	name: string;
	description: string;
	record_counts: RecordCounts;
	last_job_id: string | null;
	latest_status: JobStatus | null;
	created_at: string;
	updated_at: string;
}

export interface DatasetResponse extends DatasetSummary {
	jobs: ImportJobSummary[];
}
