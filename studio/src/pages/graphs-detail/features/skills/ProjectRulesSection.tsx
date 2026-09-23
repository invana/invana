/**
 * **Working rules** — a Project's own statements, under the Graph invariants it
 * inherits ([RU8](docs/for-developers/modules/skills/features/rules.md#decisions),
 * drawn as `RulesProject`).
 *
 * It sits in the project's **Details** tab rather than a fifth tab of its own:
 * a rule that is always true of this work is part of what the project *is*,
 * which is where the project's own acts already live (PT13).
 *
 * ## Two lists, in the order a step is given them
 *
 * The response returns the inherited invariants beside the project's own rather
 * than merged, and this draws them the same way round as assembly does — the
 * Graph's first, then the Project's (C3 · RU2). Merging them would make an
 * invariant look editable from a project that only inherits it, and reordering
 * them would be a third opinion about a context nobody else assembles.
 *
 * A project with no working rules still shows the inherited ones: an empty
 * section is never an empty context.
 */

import {
	useCreateProjectRuleMutation,
	useProjectRulesQuery,
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
import { Plus } from "lucide-react";
import { useState } from "react";

export function ProjectRulesSection({
	username,
	graphSlug,
	projectKey,
	frozen,
}: {
	username: string;
	graphSlug: string;
	projectKey: string;
	/** An archived project is read-only, so it is not written to here either. */
	frozen?: boolean;
}) {
	const rules = useProjectRulesQuery(username, graphSlug, projectKey);
	const create = useCreateProjectRuleMutation(username, graphSlug, projectKey);
	const [composing, setComposing] = useState(false);

	const own = rules.data?.items ?? [];
	const inherited = rules.data?.inherited ?? [];

	return (
		<PanelSection
			title="Working rules"
			hint="offered to every step in this project, after the Graph's invariants"
			action={
				frozen ? null : (
					<Button
						size="sm"
						variant="ghost"
						className="h-6 text-base"
						onClick={() => setComposing((v) => !v)}
					>
						<Plus className="size-3" />
						{composing ? "Cancel" : "New working rule"}
					</Button>
				)
			}
		>
			{rules.isLoading ? (
				<Spinner />
			) : (
				<div className="-mx-3">
					<Inherited items={inherited} />

					{composing ? (
						<RuleStatementForm
							pending={create.isPending}
							onSubmit={(statement, done) =>
								create.mutate(
									{ statement },
									{
										onSuccess: () => {
											done();
											setComposing(false);
										},
									},
								)
							}
							onCancel={() => setComposing(false)}
						/>
					) : null}

					{own.length === 0 ? (
						<p className="px-3 py-2 text-base text-muted-foreground">
							No working rules of its own. This project runs on the invariants
							above — a working rule is one that is true of <em>this work</em>{" "}
							and not of the whole Graph.
						</p>
					) : (
						own.map((rule) => (
							<OwnRule
								key={rule.id}
								username={username}
								graphSlug={graphSlug}
								rule={rule}
								frozen={frozen}
							/>
						))
					)}
				</div>
			)}
		</PanelSection>
	);
}

/** The Graph's invariants, above and read-only — inherited, never edited here. */
function Inherited({ items }: { items: Rule[] }) {
	return (
		<>
			<p className="px-3 pb-1 text-base text-muted-foreground">
				{items.length === 0
					? "This Graph has no invariants yet, so the project is offered only what is below."
					: `Inherited from the Graph · ${items.length} invariant${items.length === 1 ? "" : "s"}, read-only here`}
			</p>
			{items.map((rule) => (
				<RuleStatementRow key={rule.id} rule={rule} readOnly />
			))}
		</>
	);
}

/**
 * One of the project's own — rewordable in place, and stoppable.
 *
 * There is no delete: deactivating is how a rule stops applying, and the past
 * citations stay (RU4).
 */
function OwnRule({
	username,
	graphSlug,
	rule,
	frozen,
}: {
	username: string;
	graphSlug: string;
	rule: Rule;
	frozen?: boolean;
}) {
	const [editing, setEditing] = useState(false);
	const reword = useUpdateRuleMutation(username, graphSlug);
	const setActive = useSetRuleActiveMutation(username, graphSlug);

	if (editing)
		return (
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
		);

	return (
		<RuleStatementRow
			rule={rule}
			trailing={
				frozen ? null : (
					<div className="mt-1 flex items-center gap-2">
						<button
							type="button"
							className="text-base text-muted-foreground hover:text-foreground"
							onClick={() => setEditing(true)}
						>
							reword
						</button>
						<button
							type="button"
							className="text-base text-muted-foreground hover:text-foreground"
							disabled={setActive.isPending}
							onClick={() =>
								setActive.mutate({ id: rule.id, active: !rule.active })
							}
						>
							{rule.active ? "stop offering it" : "offer it again"}
						</button>
					</div>
				)
			}
		/>
	);
}
