/**
 * IAM's half of an agent's **Access** tab (board `agents.agent.access`) — what
 * is enforced today, read from the effective-access endpoint IAM's own agent
 * page draws. The Agents product renders it through its `AccessPanel` slot,
 * beside *May delegate to*, which is the agent's own setting.
 *
 * - **Policies it holds** — policy · kind · allows · owner, and *Attach a
 *   policy* in the card's foot. It is the IAM act itself (`POST …/iam/policies/{name}/holders`), so it needs
 *   iam-admin; without it the button is disabled and says who holds it.
 * - **Functions** — one row per function its skills need or its policies
 *   allow: *Its skills need* · *Its policies* · *Started by* (the signed-in
 *   reader) · *World* · *Effective* · *Why not*, allowed rows
 *   first. Every verdict is the engine's; the panel only draws it.
 */

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useAuth } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { FormError, PanelSection } from "@invana-studio/ui";
import { Check, Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ReadState } from "../people/listParts";
import {
	useEffectiveQuery,
	usePoliciesQuery,
	usePolicyMutations,
} from "../queries";
import type { EffectiveRead, EffectiveRow, Says } from "../types";

/** The agent the panel is about — its id and the name its copy says. */
interface AgentRef {
	id: string;
	name: string;
}

export interface AgentAccessPanelProps {
	username: string;
	graphSlug: string;
	agent: AgentRef;
	/** Opens the agent's envelope drawing, on its own page. */
	onOpenEnvelope: () => void;
}

/** Policies an agent may be attached to — every one in the Graph but a token's inline. */
const ATTACHABLE = { filters: { kind: ["managed", "custom", "boundary"] } };

const Yes = () => <Check aria-label="yes" className="size-3.5 text-success" />;
const No = () => <X aria-label="no" className="size-3.5 text-destructive" />;
const Dash = () => (
	<Minus aria-label="not asked" className="size-3.5 text-muted-foreground" />
);

/** One layer's verdict as a mark: allows · refuses · not asked. */
const Verdict = ({ says }: { says: Says }) =>
	says === "allows" ? <Yes /> : says === "refuses" ? <No /> : <Dash />;

export function AgentAccessPanel({
	username,
	graphSlug,
	agent,
	onOpenEnvelope,
}: AgentAccessPanelProps) {
	const reader = useAuth().user?.id;
	const effective = useEffectiveQuery(username, graphSlug, agent.id, {
		started_by: reader,
	});
	const read = effective.data;
	if (!read)
		return (
			<ReadState
				loading={effective.isLoading}
				error={effective.error}
				what="what this agent may do"
				onRetry={() => void effective.refetch()}
			/>
		);
	return (
		<>
			<PoliciesItHolds
				username={username}
				graphSlug={graphSlug}
				agent={agent}
				read={read}
			/>
			<Functions read={read} onOpenEnvelope={onOpenEnvelope} />
		</>
	);
}

/** The policies the agent holds, and the IAM act that attaches another. */
function PoliciesItHolds({
	username,
	graphSlug,
	agent,
	read,
}: {
	username: string;
	graphSlug: string;
	agent: AgentRef;
	read: EffectiveRead;
}) {
	const [attaching, setAttaching] = useState(false);
	return (
		<PanelSection card title="Policies it holds">
			{read.policies.length ? (
				<Table bordered={false}>
					<TableHeader>
						<TableRow>
							<TableHead>Policy</TableHead>
							<TableHead>Kind</TableHead>
							<TableHead>Allows</TableHead>
							<TableHead>Owner</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{read.policies.map((p) => (
							<TableRow key={p.id}>
								<TableCell className="font-medium">{p.name}</TableCell>
								<TableCell>
									<Badge variant="outline" tone="muted" size="xs">
										{p.kind}
									</Badge>
								</TableCell>
								<TableCell className="text-muted-foreground">
									{p.summary}
								</TableCell>
								<TableCell className="text-muted-foreground">
									{p.owner ?? (p.kind === "managed" ? "built in" : "—")}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : (
				<p className="text-muted-foreground">
					It holds no policy, so every function needing one is refused. Attach a
					policy to let it act.
				</p>
			)}
			<div className="flex flex-wrap items-center justify-between gap-2 pt-2">
				<ActButton
					area="iam"
					size="sm"
					variant="outline"
					onClick={() => setAttaching(true)}
				>
					<Plus className="size-4" />
					Attach a policy
				</ActButton>
				<span className="text-sm text-muted-foreground">
					Policies are made in IAM; attaching one here is the same act as in IAM
				</span>
			</div>
			<AttachPolicyDialog
				username={username}
				graphSlug={graphSlug}
				agent={agent}
				held={read.policies.map((p) => p.name)}
				open={attaching}
				onClose={() => setAttaching(false)}
			/>
		</PanelSection>
	);
}

/** Pick one of the Graph's policies the agent does not hold yet, and attach it. */
function AttachPolicyDialog({
	username,
	graphSlug,
	agent,
	held,
	open,
	onClose,
}: {
	username: string;
	graphSlug: string;
	agent: AgentRef;
	held: string[];
	open: boolean;
	onClose: () => void;
}) {
	const policies = usePoliciesQuery(
		open ? username : undefined,
		graphSlug,
		ATTACHABLE,
	);
	const { attach } = usePolicyMutations({ username, graphSlug });
	const [name, setName] = useState("");
	const offered = (policies.data?.items ?? []).filter(
		(p) => p.status === "saved" && !held.includes(p.name),
	);

	const close = () => {
		setName("");
		attach.reset();
		onClose();
	};

	return (
		<Dialog open={open} onOpenChange={(next) => !next && close()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Attach a policy to {agent.name}</DialogTitle>
					<DialogDescription>
						It may then do what the policy allows, within its limits. The same
						act as attaching it in IAM.
					</DialogDescription>
				</DialogHeader>
				<Select value={name} onValueChange={setName}>
					<SelectTrigger aria-label="Policy" className="w-full">
						<SelectValue
							placeholder={
								policies.isLoading
									? "Reading the policies…"
									: offered.length
										? "Choose a policy"
										: "Every saved policy is already held"
							}
						/>
					</SelectTrigger>
					<SelectContent>
						{offered.map((p) => (
							<SelectItem key={p.id} value={p.name}>
								{p.name} · {p.kind} — {p.summary}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<FormError error={attach.error ?? policies.error} />
				<DialogFooter>
					<Button variant="ghost" onClick={close}>
						Cancel
					</Button>
					<Button
						disabled={!name || attach.isPending}
						onClick={() =>
							attach.mutate(
								{
									name,
									data: {
										holder_kind: "agent",
										holder_id: agent.id,
										ends: "always",
									},
								},
								{
									onSuccess: () => {
										toast.success(`${agent.name} now holds ${name}.`);
										close();
									},
								},
							)
						}
					>
						{attach.isPending ? "Attaching…" : "Attach"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Allowed first, then what its skills need — the engine's order within each. */
const ordered = (rows: EffectiveRow[]) =>
	[...rows].sort(
		(a, b) =>
			Number(b.effective === "allowed") - Number(a.effective === "allowed") ||
			Number(b.needs) - Number(a.needs),
	);

/** Every function, layer by layer, as the engine decided it. */
function Functions({
	read,
	onOpenEnvelope,
}: {
	read: EffectiveRead;
	onOpenEnvelope: () => void;
}) {
	return (
		<PanelSection
			card
			title="Functions"
			action={
				<Button size="sm" variant="ghost" onClick={onOpenEnvelope}>
					Draw the envelope
				</Button>
			}
		>
			{read.rows.length ? (
				<Table bordered={false}>
					<TableHeader>
						<TableRow>
							<TableHead>Function</TableHead>
							<TableHead>Its skills need</TableHead>
							<TableHead>Its policies</TableHead>
							<TableHead>
								Started by
								{read.started_by ? ` · ${read.started_by.name}` : ""}
							</TableHead>
							<TableHead>
								World{read.world ? ` · ${read.world.name}` : ""}
							</TableHead>
							<TableHead>Effective</TableHead>
							<TableHead>Why not</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{ordered(read.rows).map((r) => {
							const ok = r.effective === "allowed";
							return (
								<TableRow key={`${r.action} ${r.resource}`}>
									<TableCell>
										<Badge
											variant="outline"
											tone="muted"
											size="xs"
											className={`font-mono font-normal${ok ? "" : " line-through"}`}
											title={r.resource}
										>
											{r.action}
										</Badge>
									</TableCell>
									<TableCell>{r.needs ? <Yes /> : <No />}</TableCell>
									<TableCell>
										<Verdict says={r.policies} />
									</TableCell>
									<TableCell>
										<Verdict says={r.started_by} />
									</TableCell>
									<TableCell>
										<Verdict says={r.world} />
									</TableCell>
									<TableCell>
										<Badge
											size="xs"
											variant="soft"
											tone={ok ? "success" : "destructive"}
										>
											{r.effective}
										</Badge>
									</TableCell>
									<TableCell className="text-muted-foreground">
										{ok ? null : r.why}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			) : (
				<p className="text-muted-foreground">
					Its policies allow nothing, and no skill needs anything yet.
				</p>
			)}
		</PanelSection>
	);
}
