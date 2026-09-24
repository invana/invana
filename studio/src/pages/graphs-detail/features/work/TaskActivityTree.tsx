/**
 * The activity tree for one task (docs/for-developers/modules/work/spec.md, journey J2).
 *
 * *Who did what, for whom, caused by what.* Two things make this readable
 * rather than a log dump:
 *
 * - **The `on behalf of` line under every agent row.** It is written by the
 *   engine from the root run, never from task input — so it is the one
 *   thing in the tree a prompt cannot influence.
 * - **Skills and rules are labelled by certainty.** *offered* is a fact about
 *   the prompt; *reported* / *cited* is the model's own claim, and the badge
 *   says so. Nothing here says "used" (docs/for-developers/modules/work/spec.md).
 *   A rule is drawn as its statement and opens its board (RU12).
 */

import { StepRules } from "@/pages/graphs-detail/features/work/StepRules";
import { stepTone } from "@/pages/graphs-detail/shared/statusTone";
import type { ActivityNode } from "@/types/work";
import { cn } from "@invana/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type CSSProperties, useState } from "react";

export interface TaskActivityTreeProps {
	nodes: ActivityNode[];
	/** A cited statement opens its rule's board (RU11 · RU12). */
	onOpenRule?: (ruleId: string) => void;
}

export function TaskActivityTree({ nodes, onOpenRule }: TaskActivityTreeProps) {
	if (!nodes.length) {
		return (
			<p className="px-3 py-4 text-base text-muted-foreground">
				Nothing has happened on this task yet.
			</p>
		);
	}
	return (
		<div className="py-1 font-mono text-base leading-relaxed">
			{nodes.map((node) => (
				<Row key={node.id} node={node} depth={0} onOpenRule={onOpenRule} />
			))}
		</div>
	);
}

function Row({
	node,
	depth,
	onOpenRule,
}: {
	node: ActivityNode;
	depth: number;
	onOpenRule?: (ruleId: string) => void;
}) {
	const [open, setOpen] = useState(true);
	const hasChildren = node.children.length > 0;
	const Chevron = open ? ChevronDown : ChevronRight;

	return (
		<div>
			<div
				// The panel's `px-3`, plus 14px a level.
				className={cn(
					"flex items-start gap-1 px-3 hover:bg-accent/50",
					depth > 0 && "ps-[calc(var(--spacing)*3+var(--row-indent))]",
				)}
				style={
					depth > 0
						? ({ "--row-indent": `${depth * 14}px` } as CSSProperties)
						: undefined
				}
			>
				{hasChildren ? (
					<button
						type="button"
						onClick={() => setOpen((v) => !v)}
						className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
						aria-label={open ? "Collapse" : "Expand"}
					>
						<Chevron className="h-3 w-3" />
					</button>
				) : (
					<span className="w-3 shrink-0" />
				)}

				<div className="min-w-0 flex-1 py-0.5">
					<div className="flex flex-wrap items-baseline gap-x-1.5">
						<span
							className={cn(
								"shrink-0",
								node.kind === "step" ? "text-foreground" : "text-primary",
							)}
						>
							{node.kind === "step" ? node.label : node.action}
						</span>
						{node.actor_name ? (
							<span className="text-muted-foreground">{node.actor_name}</span>
						) : node.actor_kind === "system" ? (
							<span className="text-muted-foreground">system</span>
						) : null}
						{node.detail ? (
							<span className="text-muted-foreground">{node.detail}</span>
						) : null}
						{node.status && node.kind === "step" ? (
							<span className={toneClass(stepTone(node.status))}>
								{node.status}
							</span>
						) : null}
						{node.tokens_in || node.tokens_out ? (
							<span className="text-muted-foreground">
								{(node.tokens_in ?? 0) + (node.tokens_out ?? 0)} tok
							</span>
						) : null}
					</div>

					{/* The line that makes the trace worth reading. */}
					{node.on_behalf_of_name ? (
						<div className="text-base text-muted-foreground">
							on behalf of {node.on_behalf_of_name}
						</div>
					) : null}

					{node.skills_offered.length ? (
						<div className="flex flex-wrap gap-1 text-base">
							{node.skills_offered.map((skill) => {
								const reported = node.skills_applied.includes(skill);
								return (
									<span
										key={skill}
										className={cn(
											"text-muted-foreground",
											reported && "text-foreground",
										)}
										title={
											reported
												? "The model reports it followed this skill — a self-report, not a fact"
												: "This skill's prose was in the prompt"
										}
									>
										{skill}
										{reported ? (
											<span className="ml-0.5 text-base text-emerald-600 dark:text-emerald-400">
												✓reported
											</span>
										) : null}
									</span>
								);
							})}
						</div>
					) : null}

					{/* The other pair, and the same two certainties (RU12). */}
					<StepRules
						offered={node.rules_offered}
						cited={node.rules_cited}
						onOpenRule={onOpenRule}
					/>
				</div>
			</div>

			{open && hasChildren
				? node.children.map((child) => (
						<Row
							key={child.id}
							node={child}
							depth={depth + 1}
							onOpenRule={onOpenRule}
						/>
					))
				: null}
		</div>
	);
}

function toneClass(tone: string): string {
	return (
		{
			success: "text-emerald-600 dark:text-emerald-400",
			danger: "text-destructive",
			warning: "text-amber-600 dark:text-amber-400",
			primary: "text-primary",
			muted: "text-muted-foreground",
		}[tone] ?? "text-muted-foreground"
	);
}
