/**
 * A function › **Used by** — the reusable plans in this Graph that name it,
 * one row per plan at its newest version, and the skills whose current
 * version's plan needs it. A row opens the record's page.
 *
 * Both lists are the engine's; an empty one is a fact — a function nothing
 * composes — and says so rather than reading as an error.
 */

import {
	EmptyState,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import type { FunctionRead } from "../types";

export function UsedByTab({
	fn,
	onOpenPlan,
	onOpenSkill,
}: {
	fn: FunctionRead;
	onOpenPlan?: (id: string) => void;
	onOpenSkill?: (id: string) => void;
}) {
	if (fn.plans.length === 0 && fn.needed_by.length === 0)
		return (
			<EmptyState
				className="h-full"
				title="Nothing names it yet"
				description={`No reusable plan and no skill in this Graph names ${fn.step_key}. A plan may still name it when it is drafted.`}
			/>
		);

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<PanelSection card title="Plans" hint={`${fn.plans.length}`}>
				{fn.plans.length === 0 ? (
					<p className="text-muted-foreground">
						No reusable plan in this Graph names it.
					</p>
				) : (
					<Table bordered={false} density="compact">
						<TableHeader>
							<TableRow>
								<TableHead className="w-full">Plan</TableHead>
								<TableHead>Key</TableHead>
								<TableHead>Origin</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{fn.plans.map((p) => (
								<TableRow
									key={p.id}
									className={onOpenPlan ? "cursor-pointer" : undefined}
									onClick={onOpenPlan ? () => onOpenPlan(p.id) : undefined}
								>
									<TableCell>{p.name || p.key}</TableCell>
									<TableCell className="font-mono">{p.key}</TableCell>
									<TableCell className="text-muted-foreground">
										{p.origin}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</PanelSection>

			<PanelSection card title="Skills" hint={`${fn.needed_by.length}`}>
				{fn.needed_by.length === 0 ? (
					<p className="text-muted-foreground">
						No skill's current version names it.
					</p>
				) : (
					<Table bordered={false} density="compact">
						<TableHeader>
							<TableRow>
								<TableHead className="w-full">Skill</TableHead>
								<TableHead>Version</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{fn.needed_by.map((s) => (
								<TableRow
									key={s.skill_id}
									className={onOpenSkill ? "cursor-pointer" : undefined}
									onClick={
										onOpenSkill ? () => onOpenSkill(s.skill_id) : undefined
									}
								>
									<TableCell>{s.name}</TableCell>
									<TableCell className="font-mono">v{s.version}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</PanelSection>
		</div>
	);
}
