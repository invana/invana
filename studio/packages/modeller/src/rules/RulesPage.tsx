/**
 * The Rules page — `/modeller/rules`, every rule in force in this Graph.
 *
 * One list from the engine, in assembly order: the install's rules, the
 * Graph's own and each project's the reader can see. A Graph's invariants are
 * its Graph-scope rules and are still offered and cited. The page has no
 * leftSection; a rule opens as a modal over it.
 *
 * | Region | What |
 * |---|---|
 * | head | *Rules*, the engine's `total`, *New rule* (`?new=1`) |
 * | filters | *Scope* · *Checked on* — `?f.scope=` · `?f.act=`, applied by the engine |
 * | list | each row the statement, then scope · checked on · mode · broken in 30 days; inactive rows dimmed in place |
 * | foot | what is not a rule — ranges are constraints, vocabularies are standards |
 * | a modal | the rule dialog, at `/modeller/rules/<rule>` or `?new=1` |
 *
 * A row seeds the rule's read with itself before it opens, so an install
 * rule — absent from the Graph's by-id route — still names its crumb.
 */

import {
	Alert,
	AlertDescription,
	Badge,
	EmptyState,
	FilterBar,
	MultiFilterChip,
	RecordHeader,
	SectionHeader,
	Skeleton,
} from "@invana/ui";
import { type Rule, useListParams, useRulesQuery } from "@invana-studio/core";
import { ActButton, usePageParams } from "@invana-studio/shell";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, ScrollText } from "lucide-react";
import { useCallback, useState } from "react";
import { RuleDialog } from "./RuleDialog";
import { ACT_LABEL, MODE_LABEL, ruleLine, SCOPE_LABEL } from "./ruleWords";

export interface RulesPageProps {
	username: string;
	graphSlug: string;
	/** *Open board* — the rule's board, beside the page. */
	onOpenRuleBoard?: (ruleId: string) => void;
}

const PURPOSE =
	"Organisation and certification policy. A guardrail bounds a run; a rule bounds what people and agents may record or decide.";

/** The rule open in the dialog: `/modeller/rules/<rule>`. */
const RULE_PARAM = "rule";
/** *New rule*: `?new=1`. */
const NEW_PARAM = "new";

const SCOPES = Object.keys(SCOPE_LABEL) as (keyof typeof SCOPE_LABEL)[];
const ACTS = Object.keys(ACT_LABEL) as (keyof typeof ACT_LABEL)[];

function RuleRow({ rule, onOpen }: { rule: Rule; onOpen: () => void }) {
	return (
		<button
			type="button"
			onClick={onOpen}
			className={`flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-muted/50 ${rule.active ? "" : "opacity-60"}`}
		>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="font-medium text-foreground">{rule.statement}</span>
				<span className="text-sm text-muted-foreground">{ruleLine(rule)}</span>
			</span>
			{rule.mode ? (
				<Badge variant="outline" size="sm" className="shrink-0">
					{MODE_LABEL[rule.mode]}
				</Badge>
			) : null}
		</button>
	);
}

export function RulesPage({
	username,
	graphSlug,
	onOpenRuleBoard,
}: RulesPageProps) {
	const queryClient = useQueryClient();
	const list = useListParams();
	const rules = useRulesQuery(username, graphSlug, list.query);
	const [params, setParams] = usePageParams();
	const [open, setOpen] = useState(true);

	const ruleId = params.get(RULE_PARAM);
	const creating = params.get(NEW_PARAM) === "1";
	const items = rules.data?.items ?? [];
	const scope = list.query.filters?.scope ?? [];
	const act = list.query.filters?.act ?? [];
	const filtered = scope.length > 0 || act.length > 0;

	const write = useCallback(
		(set: Record<string, string | null>) =>
			setParams((prev) => {
				const next = new URLSearchParams(prev);
				for (const [key, value] of Object.entries(set)) {
					if (value) next.set(key, value);
					else next.delete(key);
				}
				return next;
			}),
		[setParams],
	);

	const openRule = (rule: Rule) => {
		queryClient.setQueryData(["rules", username, graphSlug, rule.id], rule);
		write({ [RULE_PARAM]: rule.id, [NEW_PARAM]: null });
	};

	const head = (
		<div className="flex flex-col">
			<RecordHeader
				variant="page"
				icon={<ScrollText />}
				crumbs={["Rules"]}
				chips={
					rules.data ? (
						<Badge variant="outline" size="sm">
							{rules.data.total}
						</Badge>
					) : null
				}
				actions={
					<ActButton
						area="model"
						size="sm"
						onClick={() => write({ [NEW_PARAM]: "1", [RULE_PARAM]: null })}
					>
						<Plus />
						New rule
					</ActButton>
				}
			/>
			<p className="px-3 pb-2 text-sm text-muted-foreground">{PURPOSE}</p>
		</div>
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{head}
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-3">
					<FilterBar className="rounded-sm border">
						<MultiFilterChip
							label="Scope"
							multiple={false}
							options={SCOPES.map((s) => ({ value: s, label: SCOPE_LABEL[s] }))}
							value={scope}
							onChange={(next) => list.setFilter("scope", next)}
						/>
						<MultiFilterChip
							label="Checked on"
							multiple={false}
							options={ACTS.map((a) => ({ value: a, label: ACT_LABEL[a] }))}
							value={act}
							onChange={(next) => list.setFilter("act", next)}
						/>
					</FilterBar>

					{rules.isLoading ? (
						<>
							<Skeleton className="h-12 w-full" />
							<Skeleton className="h-12 w-full" />
						</>
					) : rules.isError ? (
						<EmptyState
							title="The rules could not be read"
							description={
								rules.error instanceof Error
									? rules.error.message
									: "The engine did not answer for this Graph."
							}
						/>
					) : !items.length ? (
						<EmptyState
							icon={<ScrollText className="size-6" />}
							title={
								filtered
									? "No rule in force matches these filters"
									: "No rules yet — a rule is one statement always true in its scope"
							}
						/>
					) : (
						<section className="flex flex-col">
							<SectionHeader
								bare
								title={
									<button
										type="button"
										aria-expanded={open}
										onClick={() => setOpen((o) => !o)}
										className="flex items-center gap-1.5"
									>
										{open ? (
											<ChevronDown className="size-3.5" />
										) : (
											<ChevronRight className="size-3.5" />
										)}
										Rules
									</button>
								}
								count={rules.data?.total ?? items.length}
							/>
							{open ? (
								<div className="flex flex-col divide-y rounded-control border bg-card">
									{items.map((rule) => (
										<RuleRow
											key={rule.id}
											rule={rule}
											onOpen={() => openRule(rule)}
										/>
									))}
								</div>
							) : null}
						</section>
					)}

					<Alert>
						<AlertDescription>
							Ranges on one property are constraints, on the model. Shared
							vocabularies are standards, in Datasets.
						</AlertDescription>
					</Alert>
				</div>
			</div>

			<RuleDialog
				username={username}
				graphSlug={graphSlug}
				ruleId={ruleId}
				creating={creating && !ruleId}
				listed={items}
				onOpenRuleBoard={onOpenRuleBoard}
				onClose={() => write({ [RULE_PARAM]: null, [NEW_PARAM]: null })}
			/>
		</div>
	);
}
