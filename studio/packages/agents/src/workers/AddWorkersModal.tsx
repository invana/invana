/**
 * **Add workers** — five steps in one modal: Where → Pool → Join token → Run
 * it → Joined. The step lives in the URL as `?add=<step>`; the minted secret
 * lives only in this component, so a reload reopens at step 1 and a token is
 * never shown twice.
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
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	PropertyList,
	PropertyRow,
	SegmentedControl,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { useEffect, useState } from "react";
import { useAgentsOpen } from "../open";
import { CopyButton, JoinedStep, RunStep } from "./AddWorkersRun";
import { labelsText } from "./parts";
import {
	useCreatePoolMutation,
	useCreateTokenMutation,
	usePoolsQuery,
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

const WHERE: { value: RunsOn; title: string; lines: string[] }[] = [
	{
		value: "docker",
		title: "Docker",
		lines: [
			"one container per worker",
			"any machine with Docker",
			"scale: by hand",
		],
	},
	{
		value: "python",
		title: "Python",
		lines: [
			"pip install, then invana worker",
			"a laptop, a VM, bare metal",
			"scale: by hand",
		],
	},
	{
		value: "kubernetes",
		title: "Kubernetes",
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

export function AddWorkersModal({
	step,
	onStep,
	onClose,
}: {
	step: AddStep;
	onStep: (step: AddStep) => void;
	onClose: () => void;
}) {
	const open = useAgentsOpen();
	const pools = usePoolsQuery();
	const createPool = useCreatePoolMutation();
	const createToken = useCreateTokenMutation();

	const [where, setWhere] = useState<RunsOn | null>(null);
	const [choice, setChoice] = useState<string>("");
	const [fresh, setFresh] = useState<NewPool>(BLANK_POOL);
	const [made, setMade] = useState<PoolRow | null>(null);
	const [expiry, setExpiry] = useState("1");
	const [cap, setCap] = useState("");
	const [created, setCreated] = useState<JoinTokenCreated | null>(null);

	// A reload (or a pasted `?add=run`) has no secret to show: start over.
	// biome-ignore lint/correctness/useExhaustiveDependencies: on mount only
	useEffect(() => {
		if (step !== "where") onStep("where");
	}, []);

	const existing = pools.data?.items.find((p) => p.id === choice) ?? null;
	const creating = choice === NEW || (!existing && !pools.data?.items.length);
	const pool: PoolRow | null = made ?? existing;
	const index = ADD_STEPS.indexOf(step);

	const slots = Number(fresh.slots);
	const poolReady = creating
		? /^[a-z0-9][a-z0-9-]*$/.test(fresh.name) && slots >= 1 && slots <= 256
		: existing != null;

	const next = async () => {
		if (step === "where") return onStep("pool");
		if (step === "pool") {
			if (creating && !made && where) {
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
		step === "where"
			? where != null
			: step === "pool"
				? poolReady && !createPool.isPending
				: step === "token"
					? created != null
					: true;

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Add workers</DialogTitle>
					<DialogDescription>
						{ADD_STEPS.map((s, i) => (
							<span
								key={s}
								className={
									s === step ? "font-medium text-foreground" : undefined
								}
							>
								{i > 0 ? " · " : ""}
								{i + 1} {STEP_TITLE[s]}
							</span>
						))}
					</DialogDescription>
				</DialogHeader>

				<div className="flex min-h-48 flex-col gap-4">
					{step === "where" ? (
						<>
							<div className="grid gap-2 sm:grid-cols-3">
								{WHERE.map((w) => (
									<Button
										key={w.value}
										variant={where === w.value ? "default" : "outline"}
										className="h-auto flex-col items-start gap-1 whitespace-normal p-3 text-left"
										aria-pressed={where === w.value}
										onClick={() => setWhere(w.value)}
									>
										<span className="font-medium">{w.title}</span>
										{w.lines.map((l) => (
											<span key={l} className="text-sm font-normal opacity-80">
												{l}
											</span>
										))}
									</Button>
								))}
							</div>
							<p className="text-sm text-muted-foreground">
								A worker only dials out to the engine over HTTPS — no inbound
								ports, no database access. It runs the steps it is sent, with
								the secrets its pool names.
							</p>
						</>
					) : null}

					{step === "pool" ? (
						<PoolStep
							pools={pools.data?.items ?? []}
							choice={creating ? NEW : choice}
							onChoice={setChoice}
							existing={existing}
							fresh={fresh}
							onFresh={setFresh}
							locked={made != null}
						/>
					) : null}

					{step === "token" && pool ? (
						<div className="flex flex-col gap-3">
							<div className="grid gap-3 sm:grid-cols-2">
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
										placeholder="no cap"
										value={cap}
										disabled={created != null}
										onChange={(e) => setCap(e.target.value)}
									/>
								</Field>
							</div>
							{created ? (
								<Field>
									<FieldLabel htmlFor="wk-secret">
										Join token · shown once
									</FieldLabel>
									<div className="flex gap-2">
										<Input
											id="wk-secret"
											className="font-mono"
											readOnly
											value={created.token}
										/>
										<CopyButton text={created.token} />
									</div>
									<FieldDescription>
										Engine URL{" "}
										<span className="font-mono">{created.engine_url}</span>
									</FieldDescription>
								</Field>
							) : (
								<div>
									<Button onClick={mint} disabled={createToken.isPending}>
										{createToken.isPending ? "Making…" : "Make token"}
									</Button>
								</div>
							)}
							<p className="text-sm text-muted-foreground">
								The token only lets a worker join{" "}
								<span className="font-medium">{pool.name}</span>. On joining,
								each worker gets its own credential, rotated hourly. Revoking
								the token stops new joins; draining stops the workers.
							</p>
							<FormError error={createToken.error} />
						</div>
					) : null}

					{step === "run" && created && pool ? (
						<RunStep
							runsOn={where ?? pool.runs_on}
							onRunsOn={setWhere}
							created={created}
							pool={pool.name}
						/>
					) : null}

					{step === "joined" && created && pool ? (
						<JoinedStep
							tokenId={created.id}
							pool={pool.name}
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
					{step === "joined" && pool ? (
						<Button
							variant="outline"
							onClick={() => {
								onClose();
								open.pool(pool.name);
							}}
						>
							Open pool
						</Button>
					) : null}
					<Button disabled={!canNext} onClick={next}>
						{step === "run" ? "I ran it" : step === "joined" ? "Done" : "Next"}
					</Button>
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
	return (
		<div className="flex flex-col gap-3">
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
			{choice === NEW ? (
				<div className="grid gap-3 sm:grid-cols-2">
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
						<FieldLabel htmlFor="wk-labels">Labels this worker adds</FieldLabel>
						<Input
							id="wk-labels"
							value={fresh.labels}
							disabled={locked}
							onChange={set("labels")}
							placeholder="cpu, egress"
						/>
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
				</div>
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
					{existing ? (
						<PropertyList labelWidth={150}>
							<PropertyRow label="Labels">
								{labelsText(existing.labels)}
							</PropertyRow>
							<PropertyRow label="Slots a worker">
								{existing.slots_per_worker}
							</PropertyRow>
							<PropertyRow label="Plugins">
								{labelsText(existing.plugins)}
							</PropertyRow>
							<PropertyRow label="Secrets">
								{labelsText(existing.secrets)}
							</PropertyRow>
							<PropertyRow label="Egress">
								{labelsText(existing.egress)}
							</PropertyRow>
						</PropertyList>
					) : null}
				</>
			)}
		</div>
	);
}
