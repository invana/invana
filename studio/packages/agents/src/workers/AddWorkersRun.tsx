/**
 * Add workers › *Run it* and *Joined*. Run it shows the exact command or
 * manifest for the platform picked in Where — with a placeholder where the
 * token goes once it is no longer in memory; Joined polls the token's status
 * every 2 s and shows each check as it lands.
 */

import { CodeBlock } from "@invana/editor";
import { Button, Spinner, Tabs, TabsList, TabsTrigger } from "@invana/ui";
import { Check, Circle, X } from "lucide-react";
import { useState } from "react";
import { RUN_NOTE, runText } from "./commands";
import { WorkersTable } from "./parts";
import { useJoinStatusQuery, usePoolQuery, useWorkersQuery } from "./queries";
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
}: {
	runsOn: RunsOn;
	onRunsOn: (r: RunsOn) => void;
	/** Null after a reload: the secret is never shown twice. */
	created: JoinTokenCreated | null;
	pool: string;
}) {
	const text = runText(runsOn, {
		engineUrl: created?.engine_url ?? window.location.origin,
		token: created?.token ?? TOKEN_PLACEHOLDER,
		pool,
	});
	const download = () => {
		const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
		const a = document.createElement("a");
		a.href = url;
		a.download =
			runsOn === "kubernetes"
				? `invana-worker-${pool}.yaml`
				: `invana-worker-${pool}.sh`;
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
			<CodeBlock
				value={text}
				language={runsOn === "kubernetes" ? "yaml" : "shell"}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<CopyButton text={text} />
				<Button size="sm" variant="ghost" onClick={download}>
					Download as a file
				</Button>
				<span className="ml-auto text-sm text-muted-foreground">
					{RUN_NOTE[runsOn]}
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

function CheckRow({ check, waitingS }: { check: JoinCheck; waitingS: number }) {
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
					<Circle className="size-4 text-muted-foreground" />
				)}
			</span>
			<span className="flex flex-col">
				<span>{CHECK_LABEL[check.key]}</span>
				{detail ? (
					<span className="text-sm text-muted-foreground">{detail}</span>
				) : null}
				{check.state === "failed" && check.fix ? (
					<span className="text-sm text-destructive">{check.fix}</span>
				) : null}
			</span>
		</li>
	);
}

const WAITING: JoinCheck[] = KEYS.map((key) => ({
	key,
	state: "waiting",
	detail: null,
	fix: null,
}));

/** The workers of the pool just joined, and what the pool now holds. */
function Arrived({ pool, worker }: { pool: PoolRow; worker: string | null }) {
	const fresh = usePoolQuery(pool.name).data ?? pool;
	const workers = useWorkersQuery({ pool: pool.id });
	return (
		<div className="flex flex-col gap-3">
			<p>
				<span className="font-mono">{worker ?? "A worker"}</span> joined{" "}
				<span className="font-medium">{fresh.name}</span> — it now has{" "}
				{fresh.workers} workers and {fresh.slots} slots.
			</p>
			{workers.data ? (
				<WorkersTable
					page={workers.data}
					onOpen={() => {}}
					empty="No worker has reported yet"
				/>
			) : null}
			<p className="text-sm text-muted-foreground">
				Every pool is scaled by hand: add or stop Docker and Python workers, or
				set the Deployment's replicas in Kubernetes.
			</p>
		</div>
	);
}

/** Step 5 — the checks, live; a worker joined ends the polling. */
export function JoinedStep({
	tokenId,
	pool,
	onNewToken,
}: {
	/** Null after a reload: there is no token to watch. */
	tokenId: string | null;
	pool: PoolRow | null;
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

	if (s?.worker_id && pool) return <Arrived pool={pool} worker={s.worker} />;

	const checks = s?.checks ?? WAITING;
	const waitingS = s?.waiting_s ?? 0;
	const tokenFailed = checks.some(
		(c) => c.key === "token" && c.state === "failed",
	);
	return (
		<div className="flex flex-col gap-3">
			<ul className="flex flex-col gap-2">
				{checks.map((c) => (
					<CheckRow key={c.key} check={c} waitingS={waitingS} />
				))}
			</ul>
			{tokenFailed || !tokenId ? (
				<div>
					<Button size="sm" variant="outline" onClick={onNewToken}>
						Make a new token
					</Button>
				</div>
			) : null}
			<div className="flex flex-col gap-1.5">
				<p className="font-medium">Nothing after 2 minutes?</p>
				<ul className="flex flex-col gap-1 text-sm text-muted-foreground">
					<li>
						<span className="font-medium text-foreground">Outbound</span> — the
						machine must reach the engine URL on 443.
					</li>
					<li>
						<span className="font-medium text-foreground">Token</span> — expired
						or used up; make a new one.
					</li>
					<li>
						<span className="font-medium text-foreground">Plugins</span> — an
						image without the pool's plugins can't join; the worker says so in
						its log.
					</li>
				</ul>
			</div>
		</div>
	);
}
