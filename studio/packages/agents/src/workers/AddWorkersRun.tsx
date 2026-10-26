/**
 * Add workers › *Run it* and *Joined*. Run it shows the exact command for the
 * platform picked in Where — with a placeholder where the token goes once it
 * is no longer in memory — and downloads the script, or for Kubernetes the
 * Deployment manifest. Joined polls the token's status every 2 s and shows
 * each check as it lands, then the workers the token brought in.
 */

import { CodeBlock } from "@invana/editor";
import {
	Alert,
	AlertDescription,
	Button,
	PropertyList,
	PropertyRow,
	Spinner,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { Check, Circle, CircleCheck, X } from "lucide-react";
import { useState } from "react";
import { downloadOf, RUN_NOTE, runText } from "./commands";
import { WorkersTable } from "./parts";
import {
	useJoinStatusQuery,
	useNewestWorkersQuery,
	usePoolQuery,
} from "./queries";
import type {
	JoinCheck,
	JoinCheckKey,
	JoinTokenCreated,
	PoolRow,
	RunsOn,
} from "./types";

const PLATFORMS = [
	{ value: "docker", label: "Docker" },
	{ value: "python", label: "Python" },
	{ value: "kubernetes", label: "Kubernetes" },
];

/** Where the token goes when this page no longer holds it. */
const TOKEN_PLACEHOLDER = "<join token — shown once>";

/** Copies text; a refusal (no clipboard permission) leaves the text selectable. */
export function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<Button
			size="sm"
			variant="outline"
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(text);
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				} catch {
					setCopied(false);
				}
			}}
		>
			{copied ? "Copied" : "Copy"}
		</Button>
	);
}

/** Step 4 — the command, for the platform chosen (switchable here). */
export function RunStep({
	runsOn,
	onRunsOn,
	created,
	pool,
	poolName,
}: {
	runsOn: RunsOn;
	onRunsOn: (r: RunsOn) => void;
	/** Null after a reload: the secret is never shown twice. */
	created: JoinTokenCreated | null;
	pool: PoolRow | null;
	poolName: string;
}) {
	const inputs = {
		engineUrl: created?.engine_url ?? window.location.origin,
		token: created?.token ?? TOKEN_PLACEHOLDER,
		image: created?.worker_image ?? "invana/worker",
		pool: poolName,
		labels: pool?.labels ?? [],
		slots: pool?.slots_per_worker ?? 4,
		replicas: pool?.replicas ?? undefined,
	};
	const text = runText(runsOn, inputs);
	const download = () => {
		const file = downloadOf(runsOn, inputs);
		const url = URL.createObjectURL(
			new Blob([file.text], { type: "text/plain" }),
		);
		const a = document.createElement("a");
		a.href = url;
		a.download = file.name;
		a.click();
		URL.revokeObjectURL(url);
	};
	return (
		<div className="flex flex-col gap-3">
			<Tabs value={runsOn} onValueChange={(v) => onRunsOn(v as RunsOn)}>
				<TabsList aria-label="Where it runs">
					{PLATFORMS.map((p) => (
						<TabsTrigger key={p.value} value={p.value}>
							{p.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<CodeBlock value={text} language="shell" />
			<p className="text-sm text-muted-foreground">{RUN_NOTE[runsOn]}</p>
			<div className="flex flex-wrap items-center gap-2">
				<CopyButton text={text} />
				<Button size="sm" variant="ghost" onClick={download}>
					Download as a file
				</Button>
				<span className="ml-auto text-sm text-muted-foreground">
					Run it on each machine; each becomes one worker
				</span>
			</div>
		</div>
	);
}

const CHECK_LABEL: Record<JoinCheckKey, string> = {
	token: "Token used",
	engine: "Engine reached",
	plugins: "Plugins loaded",
	labels: "Labels match the pool",
	heartbeat: "First heartbeat",
};

const KEYS: JoinCheckKey[] = [
	"token",
	"engine",
	"plugins",
	"labels",
	"heartbeat",
];

/** One check: its mark and name on the left, what the engine saw on the right. */
function CheckRow({
	check,
	waitingS,
	next,
}: {
	check: JoinCheck;
	waitingS: number;
	/** The first check still waiting — the one being waited on now. */
	next: boolean;
}) {
	const detail =
		check.detail ??
		(check.state === "waiting" ? `waiting · ${waitingS} s` : null);
	return (
		<li className="flex items-start gap-2">
			<span className="mt-0.5">
				{check.state === "ok" ? (
					<Check className="size-4 text-success" />
				) : check.state === "failed" ? (
					<X className="size-4 text-destructive" />
				) : (
					<Circle
						className={`size-4 ${next ? "fill-info text-info" : "text-muted-foreground"}`}
					/>
				)}
			</span>
			<span className="flex flex-1 flex-col">
				<span>{CHECK_LABEL[check.key]}</span>
				{check.state === "failed" && check.fix ? (
					<span className="text-sm text-destructive">{check.fix}</span>
				) : null}
			</span>
			{detail ? (
				<span className="text-sm text-muted-foreground">{detail}</span>
			) : null}
		</li>
	);
}

const WAITING: JoinCheck[] = KEYS.map((key) => ({
	key,
	state: "waiting",
	detail: null,
	fix: null,
}));

/** The workers the token brought in, and what the pool now holds. */
function Arrived({ pool, joins }: { pool: PoolRow; joins: number }) {
	const fresh = usePoolQuery(pool.name).data ?? pool;
	const workers = useNewestWorkersQuery(pool.id, joins);
	return (
		<div className="flex flex-col gap-3">
			<Alert tone="success">
				<CircleCheck className="size-4" />
				<AlertDescription>
					{joins} worker{joins === 1 ? "" : "s"} joined{" "}
					<span className="font-medium">{fresh.name}</span> — it now has{" "}
					{fresh.workers} workers and {fresh.slots} slots.
				</AlertDescription>
			</Alert>
			{workers.data ? (
				<WorkersTable
					page={workers.data}
					onOpen={() => {}}
					empty="No worker has reported yet"
					showCount={false}
				/>
			) : null}
			<p className="text-sm text-muted-foreground">
				Every pool is scaled by hand: add or stop Docker and Python workers, or
				set the Deployment's replicas in Kubernetes.
			</p>
		</div>
	);
}

/** Step 5 — the checks, live; the token's workers once every check passed. */
export function JoinedStep({
	tokenId,
	pool,
	engineUrl,
	onNewToken,
}: {
	/** Null when the pool has no join token yet. */
	tokenId: string | null;
	pool: PoolRow | null;
	engineUrl: string;
	onNewToken: () => void;
}) {
	const status = useJoinStatusQuery(tokenId);
	const s = status.data;

	if (tokenId && !s)
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Spinner /> Waiting for the first worker…
			</div>
		);

	const checks = s?.checks ?? WAITING;
	const allOk = checks.every((c) => c.state === "ok");
	if (s && allOk && pool) return <Arrived pool={pool} joins={s.joins} />;

	const waitingS = s?.waiting_s ?? 0;
	const nextKey = checks.find((c) => c.state === "waiting")?.key;
	const tokenFailed = checks.some(
		(c) => c.key === "token" && c.state === "failed",
	);
	const host = engineUrl.replace(/^https?:\/\//, "").replace(/[:/].*$/, "");
	return (
		<div className="flex flex-col gap-3">
			<ul className="flex flex-col gap-2">
				{checks.map((c) => (
					<CheckRow
						key={c.key}
						check={c}
						waitingS={waitingS}
						next={c.key === nextKey}
					/>
				))}
			</ul>
			{tokenFailed || !tokenId ? (
				<div>
					<Button size="sm" variant="outline" onClick={onNewToken}>
						Make a new token
					</Button>
				</div>
			) : null}
			<PanelSection card title="Nothing after 2 minutes?">
				<PropertyList labelWidth={100}>
					<PropertyRow label="Outbound">
						the machine must reach {host} on 443
					</PropertyRow>
					<PropertyRow label="Token">
						expired or used up — make a new one
					</PropertyRow>
					<PropertyRow label="Plugins">
						an image without {labelsOr(pool?.plugins)} can't join a pool that
						needs it — the worker says so in its log
					</PropertyRow>
				</PropertyList>
			</PanelSection>
		</div>
	);
}

const labelsOr = (plugins: string[] | undefined) =>
	plugins?.length ? plugins.join(", ") : "the pool's plugins";
