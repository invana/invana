/**
 * Workers — mirrors engine/src/invana/apps/workers/schemas.py. Install-wide
 * (`/api/v1/workers`). Every number is the engine's; Studio formats it.
 */

import type { Page } from "@invana-studio/core";

export type PoolState = "keeping_up" | "short" | "no_workers" | "healthy";
export type RunsOn = "docker" | "python" | "kubernetes";
export type WorkerState =
	| "starting"
	| "busy"
	| "idle"
	| "draining"
	| "lost"
	| "stopped";

export interface PoolRow {
	id: string;
	name: string;
	runs_on: RunsOn;
	runs_on_detail: string;
	labels: string[];
	slots_per_worker: number;
	plugins: string[];
	secrets: string[];
	egress: string[];
	set_by: "hand" | "replicas";
	replicas: number | null;
	workers: number;
	starting: number;
	lost: number;
	slots: number;
	slots_busy: number;
	queued: number;
	oldest_s: number | null;
	state: PoolState;
	created_at: string;
}

export interface PoolIn {
	name: string;
	runs_on: RunsOn;
	labels: string[];
	slots_per_worker: number;
	plugins: string[];
	secrets: string[];
	egress: string[];
}

interface PoolTotals {
	workers: number;
	starting: number;
	lost: number;
	slots: number;
	slots_busy: number;
	busy_pct: number | null;
	queued: number;
	oldest_s: number | null;
	envelopes_a_minute: number;
	envelopes_vs_7d_pct: number | null;
	lost_24h: number;
	lost_24h_last: string | null;
}

interface SeriesPoint {
	at: string;
	workers: number;
}

interface SeriesMark {
	at: string;
	label: string;
}

export interface PoolsOverview {
	executor: "inline" | "procrastinate";
	totals: PoolTotals;
	series: SeriesPoint[];
	marks: SeriesMark[];
}

export interface RunningStep {
	function: string;
	run_id: string;
	run_number: number | null;
	agent: string | null;
	for_s: number | null;
}

export interface WorkerRow {
	id: string;
	pool_id: string;
	pool: string;
	name: string;
	node: string;
	version: string;
	labels: string[];
	state: WorkerState;
	running: RunningStep[];
	slots: number;
	slots_busy: number;
	heartbeat_s: number | null;
	cpu: number | null;
	up_s: number | null;
	note: string | null;
	joined_at: string;
	from_ip: string | null;
}

interface WorkerStateCounts {
	all: number;
	busy: number;
	idle: number;
	starting: number;
	lost: number;
}

export interface WorkerListPage extends Page<WorkerRow> {
	counts: WorkerStateCounts;
}

interface CpuPoint {
	at: string;
	cpu: number | null;
}

interface WorkerLogLine {
	at: string;
	line: string;
}

export interface WorkerDetail extends WorkerRow {
	steps_1h: number;
	failed_1h: number;
	p95_ms: number | null;
	cpu_series: CpuPoint[];
	log: WorkerLogLine[];
}

export interface CapacityRow {
	pool_id: string;
	pool: string;
	runs_on: RunsOn;
	ready: number;
	oldest_s: number | null;
	workers: number;
	suggested: number;
	state: PoolState;
	callout: string | null;
	unroutable_label: string | null;
}

export interface Capacity {
	rows: CapacityRow[];
	computed_at: string | null;
}

export interface WorkerEventRow {
	id: string;
	at: string;
	pool_id: string;
	pool: string;
	worker: string | null;
	change: "joined" | "lost" | "drained" | "stopped" | "replicas";
	change_text: string;
	why: string;
	actor: string | null;
}

export interface JoinTokenIn {
	pool_id: string;
	name?: string | null;
	/** Null is never. */
	expires_in_days: number | null;
	/** Null is no cap. */
	cap: number | null;
}

export interface JoinTokenRow {
	id: string;
	display: string;
	pool_id: string;
	pool: string;
	made_by: string | null;
	expires_at: string | null;
	joins: number;
	cap: number | null;
	last_used_at: string | null;
	created_at: string;
	revoked: boolean;
}

export interface JoinTokenCreated extends JoinTokenRow {
	/** The secret, returned once. */
	token: string;
	engine_url: string;
}

export type JoinCheckKey =
	| "token"
	| "engine"
	| "plugins"
	| "labels"
	| "heartbeat";

export interface JoinCheck {
	key: JoinCheckKey;
	state: "waiting" | "ok" | "failed";
	detail: string | null;
	fix: string | null;
}

export interface JoinStatus {
	token_id: string;
	checks: JoinCheck[];
	worker_id: string | null;
	worker: string | null;
	waiting_s: number;
}
