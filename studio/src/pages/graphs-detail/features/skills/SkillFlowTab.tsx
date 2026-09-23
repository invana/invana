/**
 * The **Flow** tab — a skill's plan, drawn in the six layers it will touch
 * ([SK16](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
 *
 * One view, not two. A node graph beside a layer strip would be two drawings of
 * one plan to keep in step, and the strip answers the question this surface is
 * actually asked: *what will this playbook engage?* It is the same six bands as
 * the run dashboard, read in the other tense — **declared** here, **touched**
 * there.
 *
 * The band comes from the engine, on the node. Deriving it here from `task`
 * would be a second copy of the catalogue's `bound`, in a language that cannot
 * see it.
 *
 * ## What it composed
 *
 * A step inlined from a library plan is an ordinary row — that is the whole of
 * [SK33](docs/for-developers/modules/skills/features/authoring-a-skill.md) — so
 * it sits in its own band beside the rest and is **marked**, not clustered:
 * clustering five composed steps into one place would undo the drawing the
 * strip exists to make. The marking is a dashed chip, and **Composed** under
 * the strip names each plan once, with what this skill tuned and whether the
 * library has published a newer version since
 * ([LB19](docs/for-developers/modules/workflows/features/the-library.md) ·
 * [SK32](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
 * It only says so: re-inlining is an act somebody asks for, because the copy is
 * what makes a published skill do tomorrow what it did today.
 */

import type {
	PlanUse,
	SkillLayer,
	SkillPlanNode,
	SkillPlanRead,
} from "@/types/skills";
import { Badge, EmptyState, Spinner } from "@invana/ui";
import { Workflow } from "lucide-react";

/** The strip's order — and `cache`, which no catalogue entry spends yet. */
const BANDS: SkillLayer[] = [
	"graph data",
	"llm",
	"third party",
	"cache",
	"human",
	"agent",
];

const DOT: Record<SkillLayer, string> = {
	"graph data": "bg-success",
	llm: "bg-info",
	"third party": "bg-warning",
	cache: "bg-muted-foreground",
	human: "bg-destructive",
	agent: "bg-muted-foreground",
};

const BAND_HINT: Record<SkillLayer, string> = {
	"graph data": "reads or writes the graph",
	llm: "spends a model call",
	"third party": "leaves the Graph",
	cache: "nothing spends it yet",
	human: "a person does it",
	agent: "the runtime, on what it already holds",
};

export function SkillFlowTab({
	plan,
	loading,
	empty,
}: {
	plan: SkillPlanRead | undefined;
	loading: boolean;
	/**
	 * What to say when there is no plan, for a caller that knows **why**.
	 *
	 * The default says a version without a plan is a fault, because inside the
	 * drawer it is: a version owns exactly one plan. The board reads a skill's
	 * *published* version, so a draft reaches this with nothing to draw and no
	 * fault to report — and a refusal that names the wrong cause is worse than
	 * none (SK21).
	 */
	empty?: { title: string; description: string };
}) {
	if (loading) return <Spinner />;
	if (!plan)
		return (
			<div className="p-4">
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

	const touched = new Set(plan.nodes.map((n) => n.layer));

	return (
		<div className="pb-3">
			<div className="flex items-center gap-1.5 border-b px-3 py-1.5">
				<span className="text-base text-muted-foreground">
					{plan.nodes.length} step{plan.nodes.length === 1 ? "" : "s"} ·{" "}
					{touched.size} of 6 layers
				</span>
				<Badge variant="secondary" className="ml-auto">
					{plan.origin}
				</Badge>
			</div>

			{BANDS.map((band) => {
				const nodes = plan.nodes.filter((n) => n.layer === band);
				const dim = nodes.length === 0;
				return (
					<div
						key={band}
						className={`flex min-h-9 items-start gap-2 border-b px-3 py-1.5 ${
							dim ? "opacity-45" : ""
						}`}
					>
						<span className="flex w-28 shrink-0 items-center gap-1.5 pt-0.5">
							<span className={`size-2 rounded-xs ${DOT[band]}`} />
							<span className="truncate text-base">{band}</span>
						</span>
						{dim ? (
							<span className="pt-0.5 text-base text-muted-foreground">
								{BAND_HINT[band]}
							</span>
						) : (
							<span className="flex min-w-0 flex-1 flex-wrap gap-1">
								{nodes.map((node) => (
									<NodeChip key={node.id} node={node} />
								))}
							</span>
						)}
					</div>
				);
			})}

			<Composed uses={plan.uses} nodes={plan.nodes} />

			<p className="px-3 py-2 text-base text-muted-foreground">
				Declared, not touched. This is what the playbook <b>will</b> engage, and
				a run's own strip says what it did. Binding it to an agent whose
				envelope forbids one of these steps is refused at bind time, naming the
				step — the world half of that check is not built yet, and a refusal says
				which grounds it read.
			</p>
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
	nodes: SkillPlanNode[];
}) {
	if (uses.length === 0) return null;

	return (
		<div className="border-b px-3 py-1.5">
			<p className="text-base text-muted-foreground">
				Composed — the dashed steps above came from these, copied in when this
				plan was written.
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

/** One node: what it runs, and the sentence it was drawn from. */
function NodeChip({ node }: { node: SkillPlanNode }) {
	const inlined = !!node.source_plan_key;
	return (
		<span
			className={`inline-flex max-w-full items-center gap-1 rounded-xs border px-1.5 py-0.5 ${
				inlined ? "border-dashed" : ""
			}`}
			title={
				inlined
					? `from ${node.source_plan_key}`
					: (node.source_span ?? undefined)
			}
		>
			<span className="truncate font-mono text-base">
				{node.task || node.label || node.id}
			</span>
			{node.form === "human" ? (
				<Badge variant="outline" className="shrink-0">
					a person
				</Badge>
			) : null}
		</span>
	);
}
