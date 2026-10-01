/**
 * The **Flow** tab — a skill's plan on `TaskFlowCanvas`
 * ([authoring-a-skill.md](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
 *
 * The plan's own tasks and edges, laid out by ELK, as Circles or Cards
 * ([task-flow-canvas.md](docs/for-developers/building-studio/task-flow-canvas.md)).
 * The run page's Flow tab draws on the same canvas, so a skill's plan and a run
 * of it read the same way. One line above it says what the plan declares — the
 * step count and how many of the six layers — which is the bind check read in
 * advance.
 *
 * ## What it composed
 *
 * A step inlined from a library plan is an ordinary node — that is the whole of
 * [authoring-a-skill.md](docs/for-developers/modules/skills/features/authoring-a-skill.md) — and
 * its hover card says which plan it came from. **Composed** under the canvas
 * names each plan once, with what this skill tuned and whether the library has
 * published a newer version since
 * ([the-library.md](docs/for-developers/modules/workflows/features/the-library.md) ·
 * [authoring-a-skill.md](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
 * It only says so: re-inlining is an act somebody asks for, because the copy is
 * what makes a published skill do tomorrow what it did today.
 */

import { Badge, EmptyState, Spinner } from "@invana/ui";
import { Workflow } from "lucide-react";
import { useMemo } from "react";
import {
	TaskFlowCanvas,
	taskFlowSettings,
	taskFlowTemplates,
} from "@/canvases/taskflow";
import { taskFlowFromPlan } from "@/canvases/taskflow/taskFlowFromPlan";
import type {
	PlanUse,
	SkillPlaybookNode,
	SkillPlaybookRead,
} from "@/pages/graphs-detail/features/skills/types";

export function SkillFlowTab({
	plan,
	loading,
	empty,
}: {
	plan: SkillPlaybookRead | undefined;
	loading: boolean;
	/**
	 * What to say when there is no plan, for a caller that knows **why**.
	 *
	 * The default says a version without a plan is a fault, because inside the
	 * section it is: a version owns exactly one plan. The board reads a skill's
	 * *published* version, so a draft reaches this with nothing to draw and no
	 * fault to report — and a refusal that names the wrong cause is worse than
	 * none.
	 */
	empty?: { title: string; description: string };
}) {
	if (loading) return <Spinner />;
	if (!plan)
		return (
			<div className="px-3 py-4">
				<EmptyState
					icon={<Workflow className="size-6" />}
					title={empty?.title ?? "No plan to draw"}
					description={
						empty?.description ??
						"Every version owns exactly one plan. If this one has none, something wrote a version without drawing it — which the engine does not allow."
					}
				/>
			</div>
		);

	return <SkillFlow plan={plan} />;
}

function SkillFlow({ plan }: { plan: SkillPlaybookRead }) {
	const data = useMemo(() => taskFlowFromPlan(plan), [plan]);
	const declared = new Set(plan.nodes.map((n) => n.layer));

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex items-center gap-1.5 border-b px-3 py-1.5">
				<span className="text-base text-muted-foreground">
					{plan.nodes.length} step{plan.nodes.length === 1 ? "" : "s"} ·{" "}
					{declared.size} of 6 layers
				</span>
				<Badge variant="secondary" className="ml-auto">
					{plan.origin}
				</Badge>
			</div>
			<div className="min-h-80 flex-1">
				<TaskFlowCanvas
					data={data}
					settings={taskFlowSettings}
					templates={taskFlowTemplates}
				/>
			</div>
			<Composed uses={plan.uses} nodes={plan.nodes} />
		</div>
	);
}

/** A tuned value, in the words the editor set it with — `yes`, never `true`. */
function spoken(value: unknown): string {
	if (typeof value === "boolean") return value ? "yes" : "no";
	return String(value);
}

/**
 * What this plan inlined, once per plan rather than once per row.
 *
 * The count is read off the rows, not off the record: `source_plan_key` is what
 * the strip above is marking, so the two can never disagree about how many
 * steps a composition put there.
 */
function Composed({
	uses,
	nodes,
}: {
	uses: PlanUse[];
	nodes: SkillPlaybookNode[];
}) {
	if (uses.length === 0) return null;

	return (
		<div className="border-b px-3 py-1.5">
			<p className="text-base text-muted-foreground">
				Composed — these steps came from library plans, copied in when this plan
				was written.
			</p>
			{uses.map((use) => {
				const ref = `${use.key}@${use.version}`;
				const count = nodes.filter((n) => n.source_plan_key === ref).length;
				const tuned = Object.entries(use.args);
				const behind = use.latest_version > use.version;
				return (
					<div key={ref} className="mt-1 flex flex-wrap items-baseline gap-1.5">
						<span className="font-mono text-base">{ref}</span>
						<Badge variant="secondary">
							{count} step{count === 1 ? "" : "s"}
						</Badge>
						{tuned.length === 0 ? (
							<span className="text-base text-muted-foreground">
								nothing tuned — it runs as the library declares it
							</span>
						) : (
							<span className="text-base text-muted-foreground">
								{tuned
									.map(([name, value]) => `${name}: ${spoken(value)}`)
									.join(" · ")}
							</span>
						)}
						{behind ? (
							<Badge variant="outline" className="shrink-0">
								v{use.latest_version} exists
							</Badge>
						) : null}
					</div>
				);
			})}
			{uses.some((u) => u.latest_version > u.version) ? (
				<p className="mt-1 text-base text-muted-foreground">
					A newer version is said, never applied — these steps are this skill's
					copy, and swapping them is an edit somebody makes on purpose.
				</p>
			) : null}
		</div>
	);
}
