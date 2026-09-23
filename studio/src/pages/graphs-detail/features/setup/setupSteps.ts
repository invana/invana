import type { SettingsSection } from "@/pages/graphs-detail/shell/useSettingsPanel";
import type { SetupGate, SetupSection } from "@/types/graphs";

/**
 * What each setup step is called, why it is there, and where it is done
 * (docs/for-developers/modules/platform/features/setup.md §3).
 *
 * One list, two renderings: the board on the graph page and the timeline in the
 * Info panel read the same rows, so the sequence cannot say two different things
 * in two places. The engine owns every *fact* about a step — done, required,
 * blocked, broken — and this file owns only the words and the destination (SU2):
 * setup has no forms of its own, so a step opens the panel that already owns
 * that field, with its tab named.
 */
/** The one Invana idea a step depends on, taught where it is about to be used
 *  (setup.md SU17). Required steps carry one; optional steps do not — a concept
 *  is taught at the step that needs it, or not at all. */
export interface SetupConcept {
	title: string;
	body: string;
}

export interface SetupStepMeta {
	key: SetupSection;
	label: string;
	/** What the step asks for — one line, in the second person. */
	description: string;
	/** One sentence: what the Graph gains by doing this (setup.md 7.1). */
	why: string;
	/** Two or three moves, each naming a surface that already exists. Never a
	 *  form of setup's own (SU2). */
	how: readonly string[];
	/** The fact that proves the step landed — what to look at, not a button to
	 *  press. Setup is derived, so there is no "I've done it" (SU1). */
	looksRight: string;
	/** The product lesson (SU17). Required steps only. */
	concept?: SetupConcept;
	/** The docked panel it opens. Switched in place via
	 *  `useSettingsPanel().setSection` rather than navigated to: the step lives
	 *  inside the page, so this is not navigation. */
	settingsSection: SettingsSection;
	/** The tab inside that panel, where it has more than one (G24). */
	settingsTab?: string;
	/** The command that does the same thing at a terminal, where one exists
	 *  (SU6). `{graph}` is replaced with `owner/slug`. Importing has no Studio
	 *  write path at all, which is why the row carries it. */
	command?: string;
}

export interface SetupGateMeta {
	gate: SetupGate;
	/** Its place in the sequence. Drawn into the heading — `1 · CONNECTED` —
	 *  because three unnumbered gates read as three unrelated groups, and the
	 *  order between them is the thing the grouping is for. */
	ordinal: number;
	title: string;
	/** What opens when the gate does. The whole reason the steps are grouped. */
	unlocks: string;
}

export const SETUP_GATE_META: readonly SetupGateMeta[] = [
	{
		gate: "connected",
		ordinal: 1,
		title: "Connected",
		unlocks: "Explorer, Query, introspection and model authoring",
	},
	{
		gate: "grounded",
		ordinal: 2,
		title: "Grounded",
		unlocks: "data on the canvas, and answers drawn from records",
	},
	{
		gate: "answering",
		ordinal: 3,
		title: "Answering",
		unlocks: "Ask, the Assistant, and every agent run",
	},
];

export const SETUP_STEPS: readonly SetupStepMeta[] = [
	{
		key: "graph_info",
		label: "Connect a database",
		description: "One Graph binds to one graph database.",
		why: "Invana never copies your graph. It reads the database where it already lives, so what Explorer draws and what an agent answers from are the same records your other tools see.",
		how: [
			"Choose a connector — Neo4j, Memgraph, JanusGraph, Neptune, ArcadeDB.",
			"Paste the URI and the credentials.",
			"Test it — the test is what saves it.",
		],
		looksRight:
			"The footer reads connected, and Explorer stops saying it is locked.",
		concept: {
			title: "A Graph is a mission, not a database",
			body: "One database can back many Graphs. A Graph is the question you are trying to answer, and everything gathered to answer it.",
		},
		settingsSection: "settings",
		settingsTab: "graph",
	},
	{
		key: "model",
		label: "Author a model",
		description:
			"Publish the node types and edge types this graph holds. Seed one from the database, or start from a starter.",
		why: "Labels in a database are strings. A model turns them into types an agent can plan against — it is the vocabulary every question is asked in.",
		how: [
			"Introspect the database, or start from a starter model.",
			"Name the types, and the relationships between them.",
			"Publish a version — a draft grounds nothing.",
		],
		looksRight:
			"The Model panel reads active on a published version, and an import will accept --model.",
		concept: {
			title: "The model is the shared vocabulary",
			body: "Ontology, not schema. Agents, queries and stitches all speak the types you publish — which is why two databases can be joined under one set of words.",
		},
		settingsSection: "model",
	},
	{
		// The step keeps the `datasets` key — it is a persisted `setup_state`
		// field — but it opens the Imports journal, which is where a load shows up
		// (inspect-what-landed.md IW7).
		key: "datasets",
		label: "Bring data in",
		description: "Import records against a published model.",
		why: "Until records exist, the model is a shape with nothing in it. Explorer draws an empty canvas, and every answer is an honest \u201cI don\u2019t know\u201d.",
		how: [
			"Pick a dataset — a CSV, a Parquet file, a JDBC source.",
			"Map its columns onto a published model.",
			"Run the import.",
		],
		looksRight: "Explorer draws nodes, and the run reads succeeded.",
		concept: {
			title: "Answers are grounded, or they are refused",
			body: "Every answer traces back LLM \u2192 query \u2192 record \u2192 dataset. Nothing is invented to fill a gap — when the graph cannot answer, Invana says so.",
		},
		// A load is a TaskRun, so the step lands on the journal that lists them —
		// the Runs panel, not an Imports panel (SR7 · G30 · G41).
		settingsSection: "runs",
		// Copied and run as-is, so it is the command's real signature: the group
		// is `records` (a Dataset is not a container, so the group names the
		// object), and `--name` and `--path` are required and not positional.
		command:
			"invana records import --graph {graph} --name <dataset> --model <Model> --path <path>",
	},
	{
		key: "providers",
		label: "Add an LLM provider",
		description:
			"Point the graph at the model you pay for, and ping it — saving stores it, the ping proves it.",
		why: "The provider plans the question; the graph answers it. Without one, Query and Explorer still work — only natural language is closed.",
		how: [
			"Add an endpoint — Anthropic, OpenAI, Bedrock, a local one. Its name is what a rule will name.",
			"Paste the key, and say which model it offers.",
			"Ping it — saving stores it, the ping proves it.",
		],
		looksRight: "The provider reads pinged, and Ask opens.",
		concept: {
			title: "Your key, your provider",
			body: "Invana sends the question and the schema, never the database. The provider writes a query; the engine runs it against your records.",
		},
		// `Agents › LLMs` — the providers left Settings when an agent stopped
		// binding one (PM6). A stacked panel takes a drawer where a tabbed one
		// takes a tab, and `settingsTab` names whichever that section has.
		settingsSection: "agents",
		settingsTab: "llms",
	},
	{
		key: "instructions",
		label: "Write the instructions",
		description: "What this graph is for, and how its agents behave.",
		why: "Standing guidance every agent reads before it plans. Worth writing once there is a model and a provider for it to instruct.",
		how: [
			"Say what this graph is for, in a paragraph.",
			"Say what its agents should and should not do.",
		],
		looksRight: "Every session opens with it already in context.",
		settingsSection: "settings",
		settingsTab: "basic",
	},
	{
		key: "skills",
		label: "Define skills",
		description: "Playbooks the graph's agents may be offered.",
		why: "A skill is a named move an agent may be offered — a way to reuse a good answer instead of re-deriving it.",
		how: [
			"Name the skill, and say when to use it.",
			"Write the steps it stands for.",
		],
		looksRight:
			"The skill is offered to an agent that matches its when-to-use.",
		settingsSection: "skills",
	},
];

export const SETUP_STEP_BY_KEY: Record<SetupSection, SetupStepMeta> =
	Object.fromEntries(SETUP_STEPS.map((s) => [s.key, s])) as Record<
		SetupSection,
		SetupStepMeta
	>;

/** The terminal line for a step, with the graph filled in. */
export function setupCommand(
	meta: SetupStepMeta,
	username: string,
	graphSlug: string,
): string | undefined {
	return meta.command?.replace("{graph}", `${username}/${graphSlug}`);
}

/**
 * What comes after ready — offers, not steps (SU4). None of these carries a
 * status: a product that opens with nine unfinished obligations reads as
 * homework.
 *
 * They are also the honest answer to "is that it?". Setup ends at the first
 * answer, but the *good* answers come from the surfaces below it — an agent
 * that knows the domain, a workflow that pins down what a good answer does, a
 * second model stitched in. Setup gets you to an answer; these are what make it
 * worth asking.
 */
export const WHAT_NEXT: readonly {
	label: string;
	description: string;
	settingsSection: SettingsSection;
}[] = [
	{
		label: "Ask a question",
		description: "The first answer is what all of this was for.",
		settingsSection: "sessions",
	},
	{
		label: "Author an agent",
		description:
			"Bind a provider, skills and what it may run. A question answered by an agent that knows the domain beats one answered from the schema alone.",
		settingsSection: "agents",
	},
	{
		label: "Build a plan",
		description:
			"Name the tasks a good answer takes, so the next one takes them too.",
		// A workflow is a reusable TaskPlan, listed in Library › Plans (SR5 · G41).
		settingsSection: "library",
	},
	{
		label: "Start a project",
		description: "Work, assigned to a person or an agent.",
		settingsSection: "projects",
	},
	{
		label: "Schedule it",
		description:
			"A question worth asking once is usually worth asking nightly.",
		settingsSection: "events",
	},
	{
		label: "Stitch a second model",
		description: "Two domains, answered as one.",
		settingsSection: "model",
	},
];
