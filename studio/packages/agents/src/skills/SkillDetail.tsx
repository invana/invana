/**
 * A skill's page — `skill:<id>` in `mainSection`
 * ([the-skill-page.md](docs/for-developers/modules/skills/features/the-skill-page.md)).
 *
 * *As a builder, I want to write a skill as a document, with the functions it
 * needs beside it, and see its Flow — what the instructions resolve to — so
 * that the instructions are the work and the flow is their consequence.*
 *
 * A page head over nine tabs:
 *
 * | Tab | What it answers |
 * |---|---|
 * | **Instructions** | the document, the functions it needs and a preview of its plan |
 * | **Flow** | the plan drawn top-down, each step tied to its line, handlers aside |
 * | **Functions** | every function the plan names, with its bound and steps |
 * | **Agents** | which agents carry it — bind and unbind |
 * | **Usage** | offered against applied, by agent and by outcome |
 * | **Exceptions** | the replans stored on the runs it was offered in |
 * | **Evals** | the gate's tiles and every case, draft against live |
 * | **Tests** | real runs of the draft, marked test |
 * | **History** | what the last publish regenerated and who picks it up; every version, its diff, one-act rollback |
 *
 * The open tab is `?tab=` beside `?page=`, written on every switch, so a
 * link or a reload opens the same tab. Publish lives in the head and on Evals,
 * both through the eval gate with a reason.
 *
 * Nothing here says *used*: offered is a fact the engine wrote when it built
 * the prompt; applied is the model's own claim, and nothing more.
 */

import { RecordHeader, TabbedPanel } from "@invana/ui";
import { useUpdateSearchParams } from "@invana-studio/core";
import { ActButton, ReadOnlyNotice } from "@invana-studio/shell";
import { DetailStatus } from "@invana-studio/ui";
import { Check, PencilLine, Play } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SECTIONS } from "../sections/spec";
import { PublishDialog } from "./PublishDialog";
import { SkillAgentsTab } from "./SkillAgentsTab";
import { SkillEvalsTab } from "./SkillEvalsTab";
import { SkillExceptionsTab } from "./SkillExceptionsTab";
import { SkillFlowTab } from "./SkillFlowTab";
import { SkillFunctionsTab } from "./SkillFunctionsTab";
import { SkillHistoryTab } from "./SkillHistoryTab";
import { SkillInstructionsTab } from "./SkillInstructionsTab";
import { SkillTestsTab } from "./SkillTestsTab";
import { SkillUsageTab } from "./SkillUsageTab";
import { useSkillOpen } from "./skillOpen";
import type { Skill } from "./types";
import { canPublish, type SkillPage, useSkillPage } from "./useSkillPage";

const SKILL_TABS = [
	"instructions",
	"flow",
	"functions",
	"agents",
	"usage",
	"exceptions",
	"evals",
	"tests",
	"history",
] as const;

export type SkillTab = (typeof SKILL_TABS)[number];

const isTab = (v: string | null): v is SkillTab =>
	!!v && (SKILL_TABS as readonly string[]).includes(v);

/** The open tab, read from and written to `?tab=`; other params are kept. */
function useSkillTab(): [SkillTab, (tab: SkillTab) => void] {
	const [params] = useSearchParams();
	const update = useUpdateSearchParams();
	const raw = params.get("tab");
	const tab = isTab(raw) ? raw : "instructions";
	const setTab = (next: SkillTab) =>
		update((prev) => {
			const out = new URLSearchParams(prev);
			out.set("tab", next);
			return out;
		});
	return [tab, setTab];
}

export function SkillDetail({
	username,
	graphSlug,
	skill,
	onOpenAgent,
}: {
	username: string;
	graphSlug: string;
	skill: Skill;
	onOpenAgent?: (id: string) => void;
}) {
	const page = useSkillPage(username, graphSlug, skill);
	const open = useSkillOpen();
	const [tab, setTab] = useSkillTab();
	const [publishing, setPublishing] = useState(false);
	const openAgent = (id: string) => (onOpenAgent ?? open?.agent)?.(id);

	const tabs: { value: SkillTab; label: string; content: React.ReactNode }[] = [
		{
			value: "instructions",
			label: "Instructions",
			content: (
				<SkillInstructionsTab page={page} onOpenFlow={() => setTab("flow")} />
			),
		},
		{
			value: "flow",
			label: "Flow",
			content: <SkillFlowTab page={page} />,
		},
		{
			value: "functions",
			label: "Functions",
			content: <SkillFunctionsTab page={page} />,
		},
		{
			value: "agents",
			label: "Agents",
			content: <SkillAgentsTab page={page} onOpenAgent={openAgent} />,
		},
		{
			value: "usage",
			label: "Usage",
			content: <SkillUsageTab page={page} onOpenAgent={openAgent} />,
		},
		{
			value: "exceptions",
			label: "Exceptions",
			content: <SkillExceptionsTab page={page} />,
		},
		{
			value: "evals",
			label: "Evals",
			content: <SkillEvalsTab page={page} onPublished={() => setTab("flow")} />,
		},
		{
			value: "tests",
			label: "Tests",
			content: <SkillTestsTab page={page} />,
		},
		{
			value: "history",
			label: "History",
			content: <SkillHistoryTab page={page} />,
		},
	];

	return (
		// `h-full`: the page host is not a flex column, so without it the page
		// grows to its content and the header and tabs scroll away with it.
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				icon={<SkillIcon />}
				crumbs={[
					open
						? { label: "Skills", onClick: () => open.section("skills") }
						: "Skills",
					skill.name,
				]}
				chips={<StateChips page={page} />}
				actions={
					page.hasDraft ? (
						<>
							<ActButton
								area="build"
								size="sm"
								variant="outline"
								onClick={() => setTab("instructions")}
							>
								<Play /> Run a test
							</ActButton>
							<ActButton
								area="build"
								size="sm"
								disabled={!canPublish(page)}
								onClick={() => setPublishing(true)}
							>
								<Check /> Publish
							</ActButton>
						</>
					) : (
						<ActButton
							area="build"
							size="sm"
							variant="outline"
							onClick={() => {
								page.startEditing();
								setTab("instructions");
							}}
						>
							<PencilLine /> Edit instructions
						</ActButton>
					)
				}
			/>
			<div className="shrink-0 px-3.5 pt-3.5 empty:hidden">
				<ReadOnlyNotice area="build" noun="skill" />
			</div>

			{/* The kit's underline strip; the page owns the border. */}
			<TabbedPanel
				className="min-h-0 flex-1 border-0 bg-transparent shadow-none"
				bodyClassName="@container"
				overflow
				activeTab={tab}
				onTabChange={(v) => setTab(isTab(v) ? v : "instructions")}
				tabs={tabs}
			/>

			<PublishDialog
				page={page}
				open={publishing}
				onClose={() => setPublishing(false)}
				onPublished={() => {
					setPublishing(false);
					setTab("flow");
				}}
			/>
		</div>
	);
}

const SkillIcon = SECTIONS.skills.icon;

/** `draft · empty` · `draft vN` · `vN · published` (+ `draft vN+1`), and one meta line. */
function StateChips({ page }: { page: SkillPage }) {
	const { skill, draft } = page;
	const empty = !page.planLoading && (page.plan?.nodes.length ?? 0) === 0;
	const draftVersion = draft?.version.version ?? skill.version + 1;
	const pin = draft?.version.model_pin;
	return (
		<>
			{skill.is_draft ? (
				<DetailStatus>
					{empty ? "draft · empty" : `draft v${draftVersion}`}
				</DetailStatus>
			) : (
				<>
					<DetailStatus tone="success">
						v{skill.version} · published
					</DetailStatus>
					{skill.draft_version_id || page.hasDraft ? (
						<DetailStatus>draft v{skill.version + 1}</DetailStatus>
					) : null}
				</>
			)}
			<span className="truncate text-sm text-muted-foreground">
				{[
					pin ? `pins ${pin}` : null,
					page.drawing
						? "drawing…"
						: draft
							? draft.drawn
								? "drawn from the text as it reads"
								: "not drawn from the saved text yet"
							: null,
				]
					.filter(Boolean)
					.join(" · ")}
			</span>
		</>
	);
}
