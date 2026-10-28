/**
 * The rule dialog — a rule at `/modeller/rules/<rule>`, or *New rule* at
 * `?new=1`, as a modal over the Rules page.
 *
 * | Field | What |
 * |---|---|
 * | Statement | one sentence; past ~140 characters it nudges that it may be two rules, never refuses |
 * | Scope | *Install · Graph · Project*, fixed once saved; *Install* only for an install Admin; *Project* picks the project |
 * | Check | *None — offered only*, or one of the closed vocabulary the scope allows, with its params |
 * | Checked on | the acts the check is read at — drawn from it, never picked |
 * | When broken | *Block · Warn · Report*; only with a check |
 * | Because | one optional line, said to whoever the rule stops |
 *
 * Under the fields, the impact line: what the check as it stands would have
 * broken in the last 30 days, read by the engine as the check changes. A rule
 * with no check has none. Saving writes to the scope's own route and publishes
 * the next version; the engine's refusal (a check the scope does not read, a
 * standard that does not exist, a write the reader may not make) is shown in
 * place.
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
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	EmptyState,
	SegmentedControl,
	Skeleton,
} from "@invana/ui";
import {
	ApiError,
	type Rule,
	type RuleCheck,
	type RuleCheckKind,
	type RuleImpactRequest,
	type RuleMode,
	type RuleScope,
	useAuth,
	useRuleImpactQuery,
	useRuleProjectsQuery,
	useRuleQuery,
	useSaveRuleMutation,
	useSetRuleActiveMutation,
} from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { FormError } from "@invana-studio/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	ACT_LABEL,
	brokenWords,
	CHECKS,
	MODE_LABEL,
	SCOPE_LABEL,
	scopeWords,
} from "./ruleWords";

export interface RuleDialogProps {
	username: string;
	graphSlug: string;
	/** The rule open; null with `creating` false keeps the dialog closed. */
	ruleId: string | null;
	creating: boolean;
	/** The rows the page lists — an install rule is read from here. */
	listed: Rule[];
	onOpenRuleBoard?: (ruleId: string) => void;
	onClose: () => void;
}

/** Past this a statement probably says two things. */
const NUDGE_AT = 140;
const NONE = "none";
const SCOPES = Object.keys(SCOPE_LABEL) as RuleScope[];
const MODES = Object.keys(MODE_LABEL) as RuleMode[];

/** What each act's broken items are called in the impact line. */
const ACT_NOUN = {
	"dataset.share": "shares",
	"dataset.bind": "binds",
	"project.decide": "decisions",
} as const;

export function RuleDialog({
	username,
	graphSlug,
	ruleId,
	creating,
	listed,
	onOpenRuleBoard,
	onClose,
}: RuleDialogProps) {
	const queryClient = useQueryClient();
	const fromList = ruleId
		? (listed.find((r) => r.id === ruleId) ?? null)
		: null;
	// A rule the list does not hold (a filtered page, a cold link) is read by id.
	const read = useRuleQuery(username, graphSlug, fromList ? null : ruleId);
	const rule = fromList ?? read.data ?? null;

	// The breadcrumb names the rule from its read; seed it from the row.
	useEffect(() => {
		if (fromList)
			queryClient.setQueryData(
				["rules", username, graphSlug, fromList.id],
				fromList,
			);
	}, [fromList, queryClient, username, graphSlug]);

	const open = creating || !!ruleId;

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-xl">
				{creating ? (
					<RuleForm
						key="new"
						username={username}
						graphSlug={graphSlug}
						rule={null}
						onClose={onClose}
					/>
				) : rule ? (
					<RuleForm
						key={rule.id}
						username={username}
						graphSlug={graphSlug}
						rule={rule}
						onOpenRuleBoard={onOpenRuleBoard}
						onClose={onClose}
					/>
				) : read.isError ? (
					<>
						<DialogHeader>
							<DialogTitle>Rule</DialogTitle>
						</DialogHeader>
						<EmptyState
							title="This rule is not in force in this Graph"
							description={
								read.error instanceof Error ? read.error.message : undefined
							}
						/>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Rule</DialogTitle>
						</DialogHeader>
						<Skeleton className="h-40 w-full" />
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

/** The check as the form holds it, or null while its params are incomplete. */
function checkOf(
	kind: string,
	licences: string,
	standard: string,
	minScore: string,
): RuleCheck | null {
	if (kind === NONE) return null;
	if (kind === "dataset.licence") {
		const allowed = licences
			.split(",")
			.map((l) => l.trim())
			.filter(Boolean);
		return allowed.length ? { kind, allowed } : null;
	}
	if (kind === "dataset.conforms") {
		if (!standard.trim()) return null;
		const score = Number(minScore);
		return {
			kind,
			standard: standard.trim(),
			min_score: minScore.trim() && Number.isFinite(score) ? score : null,
		};
	}
	return { kind: kind as RuleCheckKind };
}

/** The impact request, settled 400ms after the last change. */
function useSettled<T>(value: T): T {
	const [settled, setSettled] = useState(value);
	const key = JSON.stringify(value);
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the value's content, not its identity
	useEffect(() => {
		const t = setTimeout(() => setSettled(value), 400);
		return () => clearTimeout(t);
	}, [key]);
	return settled;
}

function RuleForm({
	username,
	graphSlug,
	rule,
	onOpenRuleBoard,
	onClose,
}: {
	username: string;
	graphSlug: string;
	rule: Rule | null;
	onOpenRuleBoard?: (ruleId: string) => void;
	onClose: () => void;
}) {
	const { isSuperuser } = useAuth();
	const save = useSaveRuleMutation(username, graphSlug);
	const setActive = useSetRuleActiveMutation(username, graphSlug);

	const [statement, setStatement] = useState(rule?.statement ?? "");
	const [scope, setScope] = useState<RuleScope>(rule?.scope ?? "graph");
	const [projectKey, setProjectKey] = useState(rule?.project_key ?? "");
	const [kind, setKind] = useState<string>(rule?.check?.kind ?? NONE);
	const [licences, setLicences] = useState(
		(rule?.check?.allowed ?? []).join(", "),
	);
	const [standard, setStandard] = useState(rule?.check?.standard ?? "");
	const [minScore, setMinScore] = useState(
		rule?.check?.min_score != null ? String(rule.check.min_score) : "",
	);
	const [mode, setMode] = useState<RuleMode>(rule?.mode ?? "warn");
	const [because, setBecause] = useState(rule?.because ?? "");

	const editing = rule !== null;
	const projects = useRuleProjectsQuery(
		username,
		graphSlug,
		scope === "project" && !editing,
	);
	const offered = CHECKS.filter((c) => c.scopes.includes(scope));
	const picked = CHECKS.find((c) => c.kind === kind) ?? null;
	const check = checkOf(kind, licences, standard, minScore);

	// A scope change drops a check the new scope does not read.
	useEffect(() => {
		if (
			kind !== NONE &&
			!CHECKS.find((c) => c.kind === kind)?.scopes.includes(scope)
		)
			setKind(NONE);
	}, [scope, kind]);

	const impactRequest = useMemo<RuleImpactRequest | null>(
		() =>
			check && (scope !== "project" || projectKey)
				? { scope, project_key: projectKey || null, check }
				: null,
		[check, scope, projectKey],
	);
	const impact = useRuleImpactQuery(
		username,
		graphSlug,
		useSettled(impactRequest),
	);

	const installLocked = scope === "install" && !isSuperuser;
	const trimmed = statement.trim();
	const incomplete =
		!trimmed ||
		(scope === "project" && !projectKey) ||
		(kind !== NONE && !check);

	const onSave = () =>
		save.mutate(
			{
				scope,
				id: rule?.id,
				projectKey: projectKey || null,
				data: {
					statement: trimmed,
					check,
					mode: check ? mode : null,
					because: because.trim() || null,
				},
			},
			{
				onSuccess: () => {
					toast.success(editing ? "Rule saved — a new version" : "Rule added");
					onClose();
				},
			},
		);

	return (
		<>
			<DialogHeader>
				<DialogTitle className="truncate">
					{editing ? rule.statement : "New rule"}
				</DialogTitle>
				<DialogDescription>
					{editing
						? `rule · ${scopeWords(rule)} · v${rule.version}`
						: "One statement, always true in its scope."}
				</DialogDescription>
			</DialogHeader>

			<div className="flex flex-col gap-4">
				<Field>
					<FieldLabel htmlFor="rule-statement">Statement</FieldLabel>
					<Input
						id="rule-statement"
						value={statement}
						onChange={(e) => setStatement(e.target.value)}
						placeholder="Airport codes are IATA, never ICAO."
					/>
					{trimmed.length > NUDGE_AT ? (
						<FieldDescription>
							A long statement often says two things — consider two rules.
						</FieldDescription>
					) : null}
				</Field>

				<Field>
					<FieldLabel>Scope</FieldLabel>
					<SegmentedControl
						size="sm"
						aria-label="Scope"
						value={scope}
						onValueChange={(v) => !editing && setScope(v as RuleScope)}
						options={SCOPES.map((s) => ({
							value: s,
							label: SCOPE_LABEL[s],
							disabled:
								(editing && s !== scope) || (s === "install" && !isSuperuser),
						}))}
					/>
					{scope === "project" && !editing ? (
						<Select value={projectKey} onValueChange={setProjectKey}>
							<SelectTrigger aria-label="Project">
								<SelectValue placeholder="Pick a project" />
							</SelectTrigger>
							<SelectContent>
								{(projects.data?.items ?? []).map((p) => (
									<SelectItem key={p.key} value={p.key}>
										{p.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : null}
					<FieldDescription>
						{editing
							? "Fixed once saved."
							: scope === "install"
								? "Offered and checked in every Graph of this install."
								: scope === "graph"
									? "Offered and checked in this Graph only."
									: "Offered and checked in one project only."}
					</FieldDescription>
				</Field>

				<Field>
					<FieldLabel>Check</FieldLabel>
					<Select value={kind} onValueChange={setKind}>
						<SelectTrigger aria-label="Check">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NONE}>None — offered only</SelectItem>
							{offered.map((c) => (
								<SelectItem key={c.kind} value={c.kind}>
									{c.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{kind === "dataset.licence" ? (
						<Input
							aria-label="Allowed licences"
							value={licences}
							onChange={(e) => setLicences(e.target.value)}
							placeholder="CC-BY-4.0, ODbL-1.0"
						/>
					) : null}
					{kind === "dataset.conforms" ? (
						<div className="flex gap-2">
							<Input
								aria-label="Standard"
								value={standard}
								onChange={(e) => setStandard(e.target.value)}
								placeholder="publisher/name"
							/>
							<Input
								aria-label="Lowest score"
								className="w-28"
								value={minScore}
								onChange={(e) => setMinScore(e.target.value)}
								placeholder="1.0"
							/>
						</div>
					) : null}
				</Field>

				<Field>
					<FieldLabel>Checked on</FieldLabel>
					<div className="flex flex-wrap gap-1.5">
						{picked ? (
							picked.acts.map((a) => (
								<Badge key={a} variant="secondary" size="sm">
									{ACT_LABEL[a]}
								</Badge>
							))
						) : (
							<span className="text-sm text-muted-foreground">
								Nothing — offered to every step in scope and cited
							</span>
						)}
					</div>
				</Field>

				{check ? (
					<Field>
						<FieldLabel>When broken</FieldLabel>
						<SegmentedControl
							size="sm"
							aria-label="When broken"
							value={mode}
							onValueChange={(v) => setMode(v as RuleMode)}
							options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
						/>
					</Field>
				) : null}

				<Field>
					<FieldLabel htmlFor="rule-because">Because</FieldLabel>
					<Input
						id="rule-because"
						value={because}
						onChange={(e) => setBecause(e.target.value)}
						placeholder="ISO 17025 audit · section 7.5"
					/>
					<FieldDescription>Shown to whoever the rule stops.</FieldDescription>
				</Field>

				{check ? <ImpactLine impact={impact} mode={mode} /> : null}

				<FormError error={save.error ?? setActive.error} />
			</div>

			<DialogFooter className="sm:justify-between">
				<div className="flex gap-2">
					{editing ? (
						<>
							<ActButton
								area="model"
								variant="outline"
								disabled={setActive.isPending || installLocked}
								onClick={() =>
									setActive.mutate({
										id: rule.id,
										active: !rule.active,
										scope: rule.scope,
									})
								}
							>
								{rule.active ? "Stop offering it" : "Offer it again"}
							</ActButton>
							{onOpenRuleBoard && rule.scope !== "install" ? (
								<Button
									variant="ghost"
									onClick={() => {
										onOpenRuleBoard(rule.id);
										onClose();
									}}
								>
									Open board
								</Button>
							) : null}
						</>
					) : null}
				</div>
				<div className="flex gap-2">
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<ActButton
						area="model"
						disabled={incomplete || installLocked || save.isPending}
						onClick={onSave}
					>
						{save.isPending ? "Saving…" : "Save rule"}
					</ActButton>
				</div>
			</DialogFooter>
		</>
	);
}

/** *Last 30 days this would have stopped N decisions* — the engine's read-back. */
function ImpactLine({
	impact,
	mode,
}: {
	impact: ReturnType<typeof useRuleImpactQuery>;
	mode: RuleMode;
}) {
	if (impact.isError)
		return (
			<Alert tone="destructive">
				<AlertDescription>
					{impact.error instanceof ApiError
						? impact.error.message
						: "The last 30 days could not be read."}
				</AlertDescription>
			</Alert>
		);
	const data = impact.data;
	if (!data)
		return (
			<Alert>
				<AlertDescription>Reading the last 30 days…</AlertDescription>
			</Alert>
		);
	const noun = data.items[0] ? ACT_NOUN[data.items[0].act] : "acts";
	return (
		<Alert tone={data.broken ? "warning" : undefined}>
			<AlertDescription className="flex flex-col gap-1">
				<span>
					{data.broken
						? `Last ${data.days} days this ${brokenWords(mode)} ${data.broken} ${noun}, of ${data.read} read.`
						: `Last ${data.days} days this would have broken nothing — ${data.read} read.`}
				</span>
				{data.items.map((item) => (
					<span
						key={`${item.subject}-${item.at}`}
						className="text-sm text-muted-foreground"
					>
						{item.subject} · {new Date(item.at).toLocaleDateString()} ·{" "}
						{item.reason}
					</span>
				))}
			</AlertDescription>
		</Alert>
	);
}
