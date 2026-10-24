import type { AgentEdge } from "@invana-studio/agents";
import { useTodoMutations } from "@invana-studio/projects";
import type { LeftNavKey } from "@invana-studio/shell";
import { CANVAS_KINDS, type CanvasKind } from "@invana-studio/shell";
import { useEffect, useState } from "react";
import type { LayeredCanvasTarget } from "@/canvases/layered/LayeredCanvasChrome";

/**
 * The selection the `leftSection` panels and the layered canvases share, and
 * which canvas kind `mainSection` is drawing.
 *
 * One piece of state per noun, held above both, because the panel and the
 * canvas are two views of the same selection: clicking a task on the plan
 * canvas lights its row, and clicking an agent on a lineage lights the agents
 * list. `settingsSection` is the open `?panel` key — a panel owns the canvas
 * kind it draws, so picking a row in it is what opens that kind.
 */
export function useLayeredCanvas(
	username: string | undefined,
	graphSlug: string | undefined,
	settingsSection: LeftNavKey,
) {
	const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(
		null,
	);
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
	const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
	const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
	const [selectedLineageEdge, setSelectedLineageEdge] =
		useState<AgentEdge | null>(null);
	// Which of the six kinds the main area is drawing. `data` is the canvas the
	// Explorer has always shown; the rest are opened from their panel.
	const [workKind, setWorkKind] = useState<CanvasKind | null>(null);
	// A dependency that would close a loop comes back as a 422 naming it; the
	// canvas shows that rather than drawing anything (docs/for-developers/modules/work/spec.mda).
	const [planError, setPlanError] = useState<string | null>(null);
	const taskMutations = useTodoMutations(username ?? "", graphSlug ?? "");

	/**
	 * **A panel's canvas belongs to the panel.**
	 *
	 * Every work panel owns a kind, and selecting a row is the gesture that opens
	 * it — there is no separate "draw it" step to discover. Before this, picking a
	 * project left the main area on the Explorer's placeholder, so four of the six
	 * kinds were reachable only through a button most people never pressed.
	 *
	 * Two rules keep it predictable:
	 *
	 * - **A canvas is replaced only by its own panel's kind.** An agent's
	 *   *envelope* and *lineage* are opened from its page, never by a panel.
	 * - **It never closes one.** Closing is the tab's X; a click that silently
	 *   threw away what you were looking at would make the canvas feel unstable.
	 */
	useEffect(() => {
		// The kind this panel would draw, given what is selected in it.
		// Projects owns both sections, so it owns the `plan` canvas whether the
		// project or one of its Todos is what was picked.
		const own: CanvasKind | null =
			settingsSection === "projects" && selectedProjectKey ? "plan" : null;
		if (!own) return;
		setWorkKind((current) => {
			if (!current) return own;
			// Already showing something this panel owns — leave the panel's own
			// choice (envelope vs lineage) alone.
			const owner = CANVAS_KINDS[current].panel;
			return owner === settingsSection ? current : own;
		});
	}, [settingsSection, selectedProjectKey]);

	// The main area, when a work canvas is open. The Explorer's data canvas is
	// still the default — these replace it only while their panel drove them
	// there, and switching back to Sessions leaves them behind.
	// What the open work canvas is drawing — the one value the tab strip and the
	// status line both need (`studio.md` § 6.26).
	const workTarget: LayeredCanvasTarget | null =
		workKind === "plan" && selectedProjectKey
			? { kind: "plan", projectKey: selectedProjectKey }
			: (workKind === "envelope" || workKind === "lineage") && selectedAgentId
				? { kind: workKind, agentId: selectedAgentId }
				: null;

	const workPageId = workTarget
		? `${workTarget.kind}:${
				"projectKey" in workTarget ? workTarget.projectKey : workTarget.agentId
			}`
		: null;

	return {
		selectedProjectKey,
		setSelectedProjectKey,
		selectedTaskId,
		setSelectedTaskId,
		selectedAgentId,
		setSelectedAgentId,
		selectedStepId,
		setSelectedStepId,
		selectedSkillId,
		setSelectedSkillId,
		selectedLineageEdge,
		setSelectedLineageEdge,
		workKind,
		setWorkKind,
		planError,
		setPlanError,
		taskMutations,
		workTarget,
		workPageId,
	};
}
