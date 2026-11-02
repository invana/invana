/**
 * **Add workers** — five steps in one modal: Where → Pool → Join token → Run
 * it → Joined. The step lives in the URL as `?add=<step>`, the platform as
 * `?where=` (Docker when absent) and the pool as `?pool=<name>` (the first
 * pool when absent), so every step draws on a cold load. The minted secret
 * lives only in this component: a reload shows Run it with a placeholder,
 * never the token a person already saw, and Joined then watches the pool's
 * newest join token.
 */

import {
	Field,
	FieldDescription,
	FieldLabel,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	PropertyList,
	PropertyRow,
	SegmentedControl,
} from "@invana/ui";
import { useUpdateSearchParams } from "@invana-studio/core";
import { FormError, PanelSection } from "@invana-studio/ui";
import {
	ArrowRight,
	Box,
	Check,
	Container,
	KeyRound,
	type LucideIcon,
	ShieldCheck,
	Terminal,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CopyButton, JoinedStep, RunStep } from "./AddWorkersRun";
import { labelsText } from "./parts";
import {
	useCreatePoolMutation,
	useCreateTokenMutation,
	useJoinStatusQuery,
	usePoolsQuery,
	useTokensQuery,
} from "./queries";
import type { JoinTokenCreated, PoolRow, RunsOn } from "./types";

export const ADD_STEPS = ["where", "pool", "token", "run", "joined"] as const;
export type AddStep = (typeof ADD_STEPS)[number];

/** A `?add=` value that names a step, else null (the modal is closed). */
export function parseAddStep(value: string | null): AddStep | null {
	if (value == null) return null;
	return (ADD_STEPS as readonly string[]).includes(value)
		? (value as AddStep)
		: "where";
}

const STEP_TITLE: Record<AddStep, string> = {
	where: "Where",
	pool: "Pool",
	token: "Join token",
	run: "Run it",
	joined: "Joined",
};

const WHERE_PARAM = "where";
const POOL_PARAM = "pool";

const PLATFORMS: RunsOn[] = ["docker", "python", "kubernetes"];

const WHERE: {
	value: RunsOn;
	title: string;
	icon: LucideIcon;
	lines: string[];
}[] = [
	{
		value: "docker",
		title: "Docker",
		icon: Container,
		lines: [
			"one container per worker",
			"any machine with Docker",
			"scale: by hand",
		],
	},
	{
		value: "python",
		title: "Python",
		icon: Terminal,
		lines: [
			"pip install, then invana worker",
			"a laptop, a VM, bare metal",
			"scale: by hand",
		],
	},
	{
		value: "kubernetes",
		title: "Kubernetes",
		icon: Box,
		lines: [
			"a deployment manifest",
			"pods in your cluster",
			"scale: replicas, set by you",
		],
	},
];

const EXPIRY = [
	{ value: "1", label: "in 24 hours", days: 1 },
	{ value: "7", label: "in 7 days", days: 7 },
	{ value: "30", label: "in 30 days", days: 30 },
	{ value: "never", label: "never — in a cluster secret", days: null },
];

const csv = (s: string): string[] =>
	s
		.split(",")
		.map((x) => x.trim())
		.filter(Boolean);

const NEW = "__new__";

interface NewPool {
	name: string;
	labels: string;
	slots: string;
	plugins: string;
	secrets: string;
	egress: string;
}

const BLANK_POOL: NewPool = {
	name: "",
	labels: "cpu",
	slots: "4",
	plugins: "",
	secrets: "",
	egress: "",
};

/** `1 Where ── 2 Pool ── …` — a tick on the steps behind, the number on the rest. */
function Stepper({ step }: { step: AddStep }) {
	const at = ADD_STEPS.indexOf(step);
	return (
		<ol className="flex items-center gap-2">
			{ADD_STEPS.map((s, i) => (
				<li
					key={s}
					className={`flex items-center gap-2 ${i < ADD_STEPS.length - 1 ? "flex-1" : ""}`}
				>
					<span
						className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${
							i < at
								? "border-primary bg-primary text-primary-foreground"
								: i === at
									? "border-primary text-primary"
									: "text-muted-foreground"
						}`}
					>
						{i < at ? <Check className="size-3" /> : i + 1}
					</span>
					<span
						className={
							i === at ? "font-medium text-primary" : "text-muted-foreground"
						}
					>
						{STEP_TITLE[s]}
					</span>
					{i < ADD_STEPS.length - 1 ? (
						<span className="h-px flex-1 bg-border" />
					) : null}
				</li>
			))}
		</ol>
	);
}

export function AddWorkersModal({
	step,
	onStep,
	onClose,
}: {
	step: AddStep;
	onStep: (step: AddStep) => void;
	onClose: () => void;
}) {
	const pools = usePoolsQuery();
	const createPool = useCreatePoolMutation();
	const createToken = useCreateTokenMutation();
	const [search] = useSearchParams();
	const update = useUpdateSearchParams();

	const param = search.get(WHERE_PARAM);
	const where: RunsOn = (PLATFORMS as string[]).includes(param ?? "")
		? (param as RunsOn)
		: "docker";
	const setWhere = (w: RunsOn) =>
		update((p) => {
			p.set(WHERE_PARAM, w);
			return p;
		});

	const [choice, setChoice] = useState<string>("");
	const [fresh, setFresh] = useState<NewPool>(BLANK_POOL);
	const [made, setMade] = useState<PoolRow | null>(null);
	const [expiry, setExpiry] = useState("1");
	const [cap, setCap] = useState("");
	const [created, setCreated] = useState<JoinTokenCreated | null>(null);

	const items = pools.data?.items ?? [];
	// `?pool=` names the pick, else the first pool, so a cold step still draws a pool.
	const named = items.find((p) => p.name === search.get(POOL_PARAM));
	const picked = choice || (named?.id ?? items[0]?.id ?? "");
	const existing = items.find((p) => p.id === picked) ?? null;
	const creating = picked === NEW || (!existing && items.length === 0);
	const pool: PoolRow | null = made ?? (creating ? null : existing);
	const index = ADD_STEPS.indexOf(step);

	const slots = Number(fresh.slots);
	const poolReady = creating
		? /^[a-z0-9][a-z0-9-]*$/.test(fresh.name) && slots >= 1 && slots <= 256
		: existing != null;

	const next = async () => {
		if (step === "where") return onStep("pool");
		if (step === "pool") {
			if (creating && !made) {
				const row = await createPool.mutateAsync({
					name: fresh.name,
					runs_on: where,
					labels: csv(fresh.labels),
					slots_per_worker: slots,
					plugins: csv(fresh.plugins),
					secrets: csv(fresh.secrets),
					egress: csv(fresh.egress),
				});
				setMade(row);
			}
			return onStep("token");
		}
		if (step === "token") return onStep("run");
		if (step === "run") return onStep("joined");
		onClose();
	};

	const mint = () => {
		if (!pool) return;
		const days = EXPIRY.find((e) => e.value === expiry)?.days ?? null;
		const capN = Number(cap);
		createToken.mutate(
			{
				pool_id: pool.id,
				expires_in_days: days,
				cap: capN >= 1 ? capN : null,
			},
			{ onSuccess: setCreated },
		);
	};

	const canNext =
		step === "pool"
			? poolReady && !createPool.isPending
			: step === "token"
				? created != null
				: true;

	const poolName = pool?.name ?? (creating ? fresh.name : "");
	// Joined watches the token minted here, else the pool's newest live one a
	// worker joined with, else its newest live one.
	const tokens = useTokensQuery(
		step === "joined" && !created ? (pool?.id ?? null) : null,
	);
	const live = tokens.data?.items.filter((t) => !t.revoked) ?? [];
	const watched =
		created?.id ?? (live.find((t) => t.joins > 0) ?? live[0])?.id ?? null;
	const engineUrl = created?.engine_url ?? window.location.origin;
	const status = useJoinStatusQuery(step === "joined" ? watched : null);
	const arrived = status.data?.checks.every((c) => c.state === "ok") ?? false;

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-5xl">
				<DialogHeader>
					<DialogTitle>
						Add workers
						{poolName ? (
							<span className="ml-2 text-sm font-normal text-muted-foreground">
								{poolName}
							</span>
						) : null}
					</DialogTitle>
				</DialogHeader>
				<Stepper step={step} />

				<div className="flex min-h-48 flex-col gap-4">
					{step === "where" ? (
						<>
							<div className="grid gap-2 sm:grid-cols-3">
								{WHERE.map((w) => (
									<Button
										key={w.value}
										variant="outline"
										className={`h-auto flex-col items-start gap-1 whitespace-normal p-3 text-left ${
											where === w.value ? "border-primary bg-primary/5" : ""
										}`}
										aria-pressed={where === w.value}
										onClick={() => setWhere(w.value)}
									>
										<span className="flex items-center gap-2 font-medium">
											<w.icon className="size-4" />
											{w.title}
										</span>
										{w.lines.map((l) => (
											<span
												key={l}
												className="text-sm font-normal text-muted-foreground"
											>
												{l}
											</span>
										))}
									</Button>
								))}
							</div>
							<Alert tone="info">
								<ShieldCheck className="size-4" />
								<AlertDescription>
									A worker only dials out to the engine over HTTPS — no inbound
									ports, no database access. It runs the steps it is sent, with
									the secrets its pool names.
								</AlertDescription>
							</Alert>
						</>
					) : null}

					{step === "pool" ? (
						<PoolStep
							pools={items}
							choice={creating ? NEW : picked}
							onChoice={setChoice}
							existing={existing}
							fresh={fresh}
							onFresh={setFresh}
							locked={made != null}
						/>
					) : null}

					{step === "token" ? (
						<div className="flex flex-col gap-3">
							{created ? (
								<Field>
									<FieldLabel htmlFor="wk-engine">Engine URL</FieldLabel>
									<Input
										id="wk-engine"
										className="font-mono"
										readOnly
										value={created.engine_url}
									/>
									<FieldDescription>
										the address workers dial out to
									</FieldDescription>
								</Field>
							) : null}
							<Field>
								<FieldLabel htmlFor="wk-secret">
									Join token · shown once
								</FieldLabel>
								<div className="flex gap-2">
									<Input
										id="wk-secret"
										className="font-mono"
										readOnly
										placeholder="made when you press Make token"
										value={created?.token ?? ""}
									/>
									{created ? (
										<CopyButton text={created.token} />
									) : (
										<Button
											size="sm"
											onClick={mint}
											disabled={!pool || createToken.isPending}
										>
											{createToken.isPending ? "Making…" : "Make token"}
										</Button>
									)}
								</div>
							</Field>
							<div className="grid gap-3 sm:grid-cols-3">
								<Field>
									<FieldLabel htmlFor="wk-token-pool">Pool</FieldLabel>
									<Input
										id="wk-token-pool"
										className="font-mono"
										readOnly
										value={poolName}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="wk-expiry">Expires</FieldLabel>
									<Select
										value={expiry}
										onValueChange={setExpiry}
										disabled={created != null}
									>
										<SelectTrigger id="wk-expiry">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{EXPIRY.map((e) => (
												<SelectItem key={e.value} value={e.value}>
													{e.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
								<Field>
									<FieldLabel htmlFor="wk-cap">Workers it may join</FieldLabel>
									<Input
										id="wk-cap"
										inputMode="numeric"
										placeholder="e.g. 8 · blank is no cap"
										value={cap}
										disabled={created != null}
										onChange={(e) => setCap(e.target.value)}
									/>
								</Field>
							</div>
							<Alert tone="info">
								<KeyRound className="size-4" />
								<AlertDescription>
									The token only lets a worker join{" "}
									<span className="font-medium">{poolName || "its pool"}</span>.
									On joining, each worker gets its own credential, rotated
									hourly. Revoking the token stops new joins; draining stops the
									workers.
								</AlertDescription>
							</Alert>
							<FormError error={createToken.error} />
						</div>
					) : null}

					{step === "run" ? (
						<RunStep
							runsOn={where}
							onRunsOn={setWhere}
							created={created}
							pool={pool}
							poolName={poolName || "<pool>"}
						/>
					) : null}

					{step === "joined" ? (
						<JoinedStep
							tokenId={watched}
							pool={pool}
							engineUrl={engineUrl}
							onNewToken={() => {
								setCreated(null);
								onStep("token");
							}}
						/>
					) : null}

					<FormError error={createPool.error} />
				</div>

				<DialogFooter>
					{step === "where" ? (
						<Button variant="ghost" onClick={onClose}>
							Cancel
						</Button>
					) : step === "joined" ? null : (
						<Button
							variant="ghost"
							onClick={() => onStep(ADD_STEPS[index - 1])}
						>
							Back
						</Button>
					)}
					{step === "joined" && !arrived ? (
						<Button variant="ghost" onClick={onClose}>
							Close
						</Button>
					) : (
						<Button disabled={!canNext} onClick={next}>
							{step === "run" || step === "joined" ? <Check /> : <ArrowRight />}
							{step === "run"
								? "I ran it"
								: step === "joined"
									? "Done"
									: "Next"}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function PoolStep({
	pools,
	choice,
	onChoice,
	existing,
	fresh,
	onFresh,
	locked,
}: {
	pools: PoolRow[];
	choice: string;
	onChoice: (c: string) => void;
	existing: PoolRow | null;
	fresh: NewPool;
	onFresh: (p: NewPool) => void;
	/** The pool is already made; Back keeps it. */
	locked: boolean;
}) {
	const set = (k: keyof NewPool) => (e: React.ChangeEvent<HTMLInputElement>) =>
		onFresh({ ...fresh, [k]: e.target.value });
	const gives =
		choice === NEW
			? {
					plugins: csv(fresh.plugins),
					secrets: csv(fresh.secrets),
					egress: csv(fresh.egress),
					labels: csv(fresh.labels),
				}
			: existing;
	return (
		<div className="grid items-start gap-4 lg:grid-cols-2">
			<div className="flex flex-col gap-3">
				<Field>
					<FieldLabel>Pool</FieldLabel>
					<SegmentedControl
						size="sm"
						aria-label="Pool"
						value={choice === NEW ? "new" : "existing"}
						onValueChange={(v) =>
							onChoice(v === "new" ? NEW : (pools[0]?.id ?? ""))
						}
						options={[
							{
								value: "existing",
								label: "Existing pool",
								disabled: !pools.length,
							},
							{ value: "new", label: "New pool" },
						]}
					/>
				</Field>
				{choice === NEW ? (
					<>
						<Field>
							<FieldLabel htmlFor="wk-name">Name</FieldLabel>
							<Input
								id="wk-name"
								value={fresh.name}
								disabled={locked}
								onChange={set("name")}
								placeholder="egress"
							/>
							<FieldDescription>Lower case, digits and -.</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="wk-labels">
								Labels this worker adds
							</FieldLabel>
							<Input
								id="wk-labels"
								value={fresh.labels}
								disabled={locked}
								onChange={set("labels")}
								placeholder="cpu, egress"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="wk-slots">Slots a worker</FieldLabel>
							<Input
								id="wk-slots"
								inputMode="numeric"
								value={fresh.slots}
								disabled={locked}
								onChange={set("slots")}
							/>
							<FieldDescription>steps it runs at once</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="wk-plugins">Plugins</FieldLabel>
							<Input
								id="wk-plugins"
								value={fresh.plugins}
								disabled={locked}
								onChange={set("plugins")}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="wk-secrets">Secrets</FieldLabel>
							<Input
								id="wk-secrets"
								value={fresh.secrets}
								disabled={locked}
								onChange={set("secrets")}
							/>
							<FieldDescription>names only, nothing else</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="wk-egress">Egress</FieldLabel>
							<Input
								id="wk-egress"
								value={fresh.egress}
								disabled={locked}
								onChange={set("egress")}
								placeholder="*.example.org"
							/>
						</Field>
					</>
				) : (
					<>
						<Field>
							<FieldLabel htmlFor="wk-pool">Pool</FieldLabel>
							<Select value={choice} onValueChange={onChoice}>
								<SelectTrigger id="wk-pool">
									<SelectValue placeholder="Pick a pool" />
								</SelectTrigger>
								<SelectContent>
									{pools.map((p) => (
										<SelectItem key={p.id} value={p.id}>
											{p.name} · {labelsText(p.labels)} · {p.workers} workers
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel>Labels this worker adds</FieldLabel>
							<span className="flex flex-wrap gap-1.5">
								{(existing?.labels ?? []).map((l) => (
									<Badge
										key={l}
										variant="outline"
										size="xs"
										className="font-mono"
									>
										{l}
									</Badge>
								))}
							</span>
						</Field>
						<Field>
							<FieldLabel htmlFor="wk-slots-existing">
								Slots a worker
							</FieldLabel>
							<Input
								id="wk-slots-existing"
								readOnly
								value={existing ? String(existing.slots_per_worker) : ""}
							/>
							<FieldDescription>steps it runs at once</FieldDescription>
						</Field>
					</>
				)}
			</div>
			<PanelSection card title="This pool gives its workers">
				<PropertyList labelWidth={130}>
					<PropertyRow label="Plugins">
						{labelsText(gives?.plugins ?? [])}
					</PropertyRow>
					<PropertyRow label="Secrets">
						{gives?.secrets.length
							? `${gives.secrets.join(", ")} — only these, nothing else`
							: "—"}
					</PropertyRow>
					<PropertyRow label="Egress">
						{labelsText(gives?.egress ?? [])}
					</PropertyRow>
					<PropertyRow label="Gets steps that need">
						{labelsText(gives?.labels ?? [])}
					</PropertyRow>
				</PropertyList>
			</PanelSection>
		</div>
	);
}
