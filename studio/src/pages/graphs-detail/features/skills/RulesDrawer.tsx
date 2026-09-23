/**
 * Rules — the second drawer of the Skills stack (G33).
 *
 * **The statement is the row.** A rule is one sentence that is always true in
 * its scope, so the row shows the sentence itself and puts kind, scope and how
 * often it was cited underneath
 * ([RulesPanel](docs/for-developers/modules/skills/features/rules.md)).
 *
 * A rule is **offered and cited, never enforced** (RU5). Nothing on this
 * surface says a run was stopped by one, because none ever is — a rule that
 * must be enforced is an envelope bound or a criterion.
 *
 * **Deactivating is not deleting** (RU4). An inactive rule stays in place,
 * dimmed, with its past citations still counted: those steps read it, and that
 * does not stop being true. There is no delete control.
 */

import {
	useCreateRuleMutation,
	useRuleCitationsQuery,
	useRulesQuery,
	useSetRuleActiveMutation,
	useUpdateRuleMutation,
} from "@/hooks/queries/useSkills";
import {
	RuleStatementForm,
	RuleStatementRow,
} from "@/pages/graphs-detail/features/skills/RuleParts";
import type { Rule } from "@/types/skills";
import { PanelSection } from "@/ui/PanelSection";
import { Button, Spinner } from "@invana/ui";
import { useState } from "react";

export function RulesDrawer({
	username,
	graphSlug,
	openRuleId,
	onOpenRule,
	composing,
	onComposing,
}: {
	username: string;
	graphSlug: string;
	openRuleId: string | null;
	onOpenRule: (id: string | null) => void;
	composing: boolean;
	onComposing: (composing: boolean) => void;
}) {
	const rules = useRulesQuery(username, graphSlug);
	const create = useCreateRuleMutation(username, graphSlug);
	const items = rules.data?.items ?? [];
	const open = items.find((r) => r.id === openRuleId) ?? null;

	if (open)
		return <RuleDetail username={username} graphSlug={graphSlug} rule={open} />;

	return (
		<div className="pb-2.5">
			{composing ? (
				<RuleStatementForm
					pending={create.isPending}
					onSubmit={(statement, done) =>
						create.mutate(
							{ statement },
							{
								onSuccess: () => {
									done();
									onComposing(false);
								},
							},
						)
					}
					onCancel={() => onComposing(false)}
				/>
			) : null}

			{rules.isLoading ? (
				<div className="p-4">
					<Spinner />
				</div>
			) : items.length === 0 ? (
				<p className="px-3 text-base text-muted-foreground">
					No rules yet. An invariant is one sentence that is always true of this
					Graph — <em>prices are in rupees</em> — offered to every step so no
					agent has to be told twice.
				</p>
			) : (
				items.map((rule) => (
					<RuleStatementRow
						key={rule.id}
						rule={rule}
						onClick={() => onOpenRule(rule.id)}
					/>
				))
			)}
		</div>
	);
}

/** One rule: its wording, where it was cited, and what is not a rule. */
function RuleDetail({
	username,
	graphSlug,
	rule,
}: {
	username: string;
	graphSlug: string;
	rule: Rule;
}) {
	const citations = useRuleCitationsQuery(username, graphSlug, rule.id);
	const setActive = useSetRuleActiveMutation(username, graphSlug);
	const reword = useUpdateRuleMutation(username, graphSlug);
	const [editing, setEditing] = useState(false);

	return (
		<div className="pb-3">
			<PanelSection
				title="Statement"
				action={
					<button
						type="button"
						onClick={() => setEditing((v) => !v)}
						className="text-base text-muted-foreground hover:text-foreground"
					>
						{editing ? "cancel" : "reword"}
					</button>
				}
				hint="rewording publishes the next version; steps that cited the old one still read the old one"
			>
				{editing ? (
					<RuleStatementForm
						existing={rule}
						pending={reword.isPending}
						onSubmit={(statement) =>
							reword.mutate(
								{ id: rule.id, data: { statement } },
								{ onSuccess: () => setEditing(false) },
							)
						}
						onCancel={() => setEditing(false)}
					/>
				) : (
					<p className="text-base text-foreground">{rule.statement}</p>
				)}
			</PanelSection>

			<PanelSection
				title={`Cited ${citations.data?.total ?? 0}×`}
				hint="a citation is the model's own claim, resolved to the wording it read"
			>
				{citations.isLoading ? (
					<Spinner />
				) : (citations.data?.items ?? []).length === 0 ? (
					<p className="text-base text-muted-foreground">
						Never cited yet.{" "}
						{rule.active
							? "It is being offered, so this is a gap worth reading."
							: "It is not being offered."}
					</p>
				) : (
					<div className="space-y-1">
						{citations.data?.items.map((c) => (
							<div key={c.step_id} className="text-base">
								<span className="text-foreground">{c.label}</span>{" "}
								<span className="text-muted-foreground">
									· v{c.version}
									{c.finished_at
										? ` · ${new Date(c.finished_at).toLocaleDateString()}`
										: ""}
								</span>
							</div>
						))}
					</div>
				)}
			</PanelSection>

			<PanelSection
				title={rule.active ? "Offered to every step in scope" : "Not offered"}
				hint="deactivating is not deleting — the versions and the citations stay"
			>
				<Button
					size="sm"
					variant="outline"
					className="h-7 text-base"
					disabled={setActive.isPending}
					onClick={() =>
						setActive.mutate({ id: rule.id, active: !rule.active })
					}
				>
					{rule.active ? "Stop offering it" : "Offer it again"}
				</Button>
			</PanelSection>
		</div>
	);
}
