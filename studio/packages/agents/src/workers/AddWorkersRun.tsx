/**
 * Add workers › *Run it* and *Joined*. Run it shows the exact command or
 * manifest for the platform picked in Where; Joined polls the token's status
 * every 2 s and shows each check as it lands.
 */

import { CodeBlock } from "@invana/editor";
import { Button, SegmentedControl, Spinner } from "@invana/ui";
import { Check, Circle, X } from "lucide-react";
import { useState } from "react";
import { RUN_NOTE, runText } from "./commands";
import { useJoinStatusQuery } from "./queries";
import type {
	JoinCheck,
	JoinCheckKey,
	JoinTokenCreated,
	RunsOn,
} from "./types";

const PLATFORMS = [
	{ value: "docker", label: "Docker" },
	{ value: "python", label: "Python" },
	{ value: "kubernetes", label: "Kubernetes" },
];

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
	created: JoinTokenCreated;
	pool: string;
}) {
	const text = runText(runsOn, {
		engineUrl: created.engine_url,
		token: created.token,
		pool,
	});
	const download = () => {
		const url = URL.createObjectURL(new Blob([text], { type: "text/yaml" }));
		const a = document.createElement("a");
		a.href = url;
		a.download = `invana-worker-${pool}.yaml`;
		a.click();
		URL.revokeObjectURL(url);
	};
	return (
		<div className="flex flex-col gap-3">
			<SegmentedControl
				size="sm"
				aria-label="Where it runs"
				value={runsOn}
				onValueChange={(v) => onRunsOn(v as RunsOn)}
				options={PLATFORMS}
			/>
			<CodeBlock
				value={text}
				language={runsOn === "kubernetes" ? "yaml" : "shell"}
			/>
			<p className="text-sm text-muted-foreground">{RUN_NOTE[runsOn]}</p>
			<div className="flex gap-2">
				<CopyButton text={text} />
				{runsOn === "kubernetes" ? (
					<Button size="sm" variant="ghost" onClick={download}>
						Download as a file
					</Button>
				) : null}
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

/** Seconds past which the troubleshooting list opens. */
const NOTHING_AFTER_S = 120;

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

/** Step 5 — the checks, live; a worker joined ends the polling. */
export function JoinedStep({
	tokenId,
	pool,
	onNewToken,
}: {
	tokenId: string;
	pool: string;
	onNewToken: () => void;
}) {
	const status = useJoinStatusQuery(tokenId);
	const s = status.data;

	if (!s)
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Spinner /> Waiting for the first worker…
			</div>
		);

	if (s.worker_id)
		return (
			<div className="flex flex-col gap-3">
				<p>
					<span className="font-mono">{s.worker ?? "A worker"}</span> joined{" "}
					<span className="font-medium">{pool}</span>.
				</p>
				<ul className="flex flex-col gap-2">
					{s.checks.map((c) => (
						<CheckRow key={c.key} check={c} waitingS={s.waiting_s} />
					))}
				</ul>
				<p className="text-sm text-muted-foreground">
					Every pool is scaled by hand: add or stop Docker and Python workers,
					or set the Deployment's replicas in Kubernetes.
				</p>
			</div>
		);

	const tokenFailed = s.checks.some(
		(c) => c.key === "token" && c.state === "failed",
	);
	return (
		<div className="flex flex-col gap-3">
			<ul className="flex flex-col gap-2">
				{s.checks.map((c) => (
					<CheckRow key={c.key} check={c} waitingS={s.waiting_s} />
				))}
			</ul>
			{tokenFailed ? (
				<Button size="sm" variant="outline" onClick={onNewToken}>
					Make a new token
				</Button>
			) : null}
			{s.waiting_s > NOTHING_AFTER_S ? (
				<div className="flex flex-col gap-1.5">
					<p className="font-medium">Nothing after 2 minutes?</p>
					<ul className="flex flex-col gap-1 text-sm text-muted-foreground">
						<li>
							<span className="font-medium text-foreground">Outbound</span> —
							the machine must reach the engine URL on 443.
						</li>
						<li>
							<span className="font-medium text-foreground">Token</span> —
							expired or used up; make a new one.
						</li>
						<li>
							<span className="font-medium text-foreground">Plugins</span> — an
							image without the pool's plugins can't join; the worker says so in
							its log.
						</li>
					</ul>
				</div>
			) : null}
		</div>
	);
}
