import {
	ArrowRight,
	CheckCircle2,
	Circle,
	Database,
	Layers,
	ScrollText,
	SkipForward,
	Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useSetupSectionMutation } from "../../../hooks/queries/useGraphs";
import type {
	Graph,
	SetupSection,
	SetupSectionState,
} from "../../../types/graphs";
import { type SettingsSection, useSettingsPanel } from "../useSettingsPanel";

const REQUIRED: SetupSection[] = ["graph_info", "instructions"];
const SKIPPABLE: SetupSection[] = ["skills", "datasets"];

interface SectionMeta {
	key: SetupSection;
	label: string;
	description: string;
	icon: typeof Database;
	/**
	 * The docked SettingsPanel section this row opens. We switch the panel in
	 * place via `useSettingsPanel().setSection` rather than `<Link>`-ing to a
	 * URL: the wizard lives inside the panel, and the graph root redirects
	 * (`/u/:u/:s` → `/explorer`) drop any `?settings=` query string, which would
	 * bounce the user to the page's empty-state instead of the form.
	 */
	settingsSection: SettingsSection;
}

const SECTIONS: SectionMeta[] = [
	{
		key: "graph_info",
		label: "Graph Info",
		description: "Attach a graph database connection.",
		icon: Database,
		settingsSection: "connection",
	},
	{
		key: "instructions",
		label: "Instructions",
		description: "Describe what this graph is for and how its agents behave.",
		icon: ScrollText,
		settingsSection: "instructions",
	},
	{
		key: "skills",
		label: "Skills",
		description: "Define what the graph's agents can do. (Optional — S5)",
		icon: Sparkles,
		settingsSection: "skills",
	},
	{
		key: "datasets",
		label: "Datasets",
		description: "Import data into the knowledge graph. (Optional — S6)",
		icon: Layers,
		settingsSection: "datasets",
	},
];

function sectionStatus(
	state: SetupSectionState | undefined,
): "done" | "skipped" | "todo" {
	if (state?.completed_at) return "done";
	if (state?.skipped_at) return "skipped";
	return "todo";
}

interface Props {
	graph: Graph;
}

/**
 * Setup wizard card — lists every required + skippable wizard section with
 * inline "Set up" / "Edit" / "Skip" / "Reset" actions. Lives inside the
 * Info section of the docked SettingsPanel so progress sits with the rest
 * of the graph overview rather than as a separate landing.
 *
 * State mutation goes through `useSetupSectionMutation` → POST
 * /u/.../setup/{section}; events flow naturally through the engine's
 * `setup.*` emit sites (RFC-018).
 */
export function SetupWizard({ graph }: Props) {
	const setupMutation = useSetupSectionMutation();
	const { setSection } = useSettingsPanel();

	const setupComplete = REQUIRED.every(
		(k) => graph.setup_state?.[k]?.completed_at,
	);

	const handleSectionAction = (
		section: SetupSection,
		action: "complete" | "skip" | "reset",
	) => {
		setupMutation.mutate(
			{
				username: graph.owner_username,
				graphSlug: graph.slug,
				section,
				action,
			},
			{
				onError: (err) => toast.error(err.message),
			},
		);
	};

	return (
		<div className="border border-border rounded-lg p-6">
			<div className="flex items-center justify-between mb-2">
				<h2 className="font-semibold">Setup</h2>
				{setupComplete ? (
					<span className="text-green-500 flex items-center gap-1.5">
						<CheckCircle2 className="w-4 h-4" />
						Ready
					</span>
				) : (
					<span className="text-muted-foreground">
						{
							SECTIONS.filter(
								(s) => sectionStatus(graph.setup_state?.[s.key]) !== "todo",
							).length
						}{" "}
						/ {SECTIONS.length} done
					</span>
				)}
			</div>
			<p className="text-muted-foreground mb-4">
				{setupComplete
					? "Modeller, Explorer, and Query are ready to use."
					: `Complete ${REQUIRED.map(
							(r) => SECTIONS.find((s) => s.key === r)?.label,
						).join(" + ")} to unlock Modeller, Explorer, and Query.`}
			</p>

			<div className="flex flex-col">
				{SECTIONS.map((section) => (
					<WizardRow
						key={section.key}
						meta={section}
						state={graph.setup_state?.[section.key]}
						onOpen={() => setSection(section.settingsSection)}
						onSkip={() => handleSectionAction(section.key, "skip")}
						onReset={() => handleSectionAction(section.key, "reset")}
					/>
				))}
			</div>
		</div>
	);
}

function WizardRow({
	meta,
	state,
	onOpen,
	onSkip,
	onReset,
}: {
	meta: SectionMeta;
	state: SetupSectionState | undefined;
	onOpen: () => void;
	onSkip: () => void;
	onReset: () => void;
}) {
	const status = sectionStatus(state);
	const Icon = meta.icon;
	const isSkippable = SKIPPABLE.includes(meta.key);

	const statusIcon =
		status === "done" ? (
			<CheckCircle2 className="w-4 h-4 text-green-500" />
		) : status === "skipped" ? (
			<SkipForward className="w-4 h-4 text-muted-foreground" />
		) : (
			<Circle className="w-4 h-4 text-muted-foreground" />
		);

	return (
		<div className="flex items-start gap-4 py-4 border-b border-border last:border-0">
			<div className="mt-0.5">{statusIcon}</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<Icon className="w-4 h-4 text-muted-foreground" />
					<span className="font-medium">{meta.label}</span>
					{status === "done" && (
						<span className="text-muted-foreground">— done</span>
					)}
					{status === "skipped" && (
						<span className="text-muted-foreground">— skipped</span>
					)}
				</div>
				<p className="text-muted-foreground mt-1">{meta.description}</p>
			</div>
			<div className="flex items-center gap-4 shrink-0">
				{status === "todo" && isSkippable && (
					<button
						type="button"
						onClick={onSkip}
						className="text-muted-foreground hover:text-foreground hover:underline"
					>
						Skip
					</button>
				)}
				{(status === "skipped" || status === "done") && (
					<button
						type="button"
						onClick={onReset}
						className="text-muted-foreground hover:text-foreground hover:underline"
					>
						Reset
					</button>
				)}
				<button
					type="button"
					onClick={onOpen}
					className="flex items-center gap-1 text-primary hover:underline font-medium"
				>
					{status === "todo" ? "Set up" : "Edit"}
					<ArrowRight className="w-3.5 h-3.5" />
				</button>
			</div>
		</div>
	);
}
