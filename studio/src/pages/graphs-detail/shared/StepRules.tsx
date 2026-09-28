/**
 * The rules a step row shows — offered, with the cited ones marked
 * ([RU12](../../../../../docs/for-developers/modules/skills/features/rules.md)).
 *
 * The same two certainties as a skill, drawn the same way so a reader does not
 * have to learn a second convention: **offered** is a fact about the prompt,
 * **cited** is the model's own claim ([RU5](../../../../../docs/for-developers/modules/skills/features/rules.md) ·
 * [RU7](../../../../../docs/for-developers/modules/skills/features/rules.md)).
 *
 * A statement is the row, never an id — an id names nothing a reader can judge,
 * and a rule's identity *is* its wording. Clicking one opens that rule's
 * `kind = rule` board ([RU11](../../../../../docs/for-developers/modules/skills/features/rules.md)).
 */

import type { OfferedRule } from "@/types/skills";
import { cn } from "@invana/ui";

export interface StepRulesProps {
	/** A fact: these statements were in the prompt. */
	offered: OfferedRule[];
	/** A claim: the model says it followed these. */
	cited: OfferedRule[];
	/** `More`, in effect — opens the rule's board. Absent where nothing can open one. */
	onOpenRule?: (ruleId: string) => void;
}

export function StepRules({ offered, cited, onOpenRule }: StepRulesProps) {
	// Nothing offered is nothing to say. A step that was given no statements is
	// not a step that ignored them, so the block is absent rather than empty.
	if (!offered.length) return null;
	const citedIds = new Set(cited.map((r) => r.rule_id));

	return (
		<div className="flex flex-col gap-0.5 text-base">
			{offered.map((rule) => {
				const wasCited = citedIds.has(rule.rule_id);
				const title = wasCited
					? "The model reports it followed this rule — a self-report, not a fact"
					: "This statement was in the prompt";
				return (
					<button
						key={rule.rule_id}
						type="button"
						disabled={!onOpenRule}
						onClick={() => onOpenRule?.(rule.rule_id)}
						title={title}
						className={cn(
							"flex items-start gap-1 text-left text-muted-foreground",
							wasCited && "text-foreground",
							onOpenRule && "hover:underline",
						)}
					>
						<span className="shrink-0">“</span>
						<span className="min-w-0">
							{rule.statement}
							<span className="shrink-0">”</span>
							{wasCited ? (
								<span className="ml-1 text-base text-emerald-600 dark:text-emerald-400">
									✓cited
								</span>
							) : null}
						</span>
					</button>
				);
			})}
		</div>
	);
}
