/**
 * The world inspector — the Worlds page's right column.
 *
 * The world and its `world` chip, then three tabs over the engine's
 * `LensView`:
 *
 * | Tab | Reads |
 * |---|---|
 * | Sees | Models *n of m*, each `all` · `sliced` · `hidden`; the window (time, geography); the cast it thinks with; who uses it |
 * | Answers go | each destination and what may be sent to it — `closed` when nothing may |
 * | Used by | the agents, schedules and people asking under it, with their runs |
 *
 * *Open board* opens the world's board (the auditor's page); *Next:
 * guardrails* moves to the Guardrails page with the world still picked.
 * *Edit* is the modeller's, and opens the world's editor.
 */

import {
	Badge,
	Button,
	EmptyState,
	Eyebrow,
	Legend,
	LegendItem,
	PropertyList,
	PropertyRow,
	RecordHeader,
	Spinner,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@invana/ui";
import { hueSlotForName } from "@invana-studio/canvases";
import { formatGrouped } from "@invana-studio/core";
import { ChevronRight, Globe, Pencil } from "lucide-react";
import type { LensView } from "../types";

export interface WorldInspectorProps {
	/** The world's name, from its own read; the view's until then. */
	name?: string;
	view?: LensView;
	isLoading: boolean;
	/** The reader holds the modeller role. */
	mayEdit: boolean;
	onEdit: () => void;
	onOpenBoard: () => void;
	onNextGuardrails: () => void;
}

const hue = (model: string) => `var(--color-data-${hueSlotForName(model)})`;

const runs = (n: number) => `${formatGrouped(n)} ${n === 1 ? "run" : "runs"}`;

export function WorldInspector({
	name,
	view,
	isLoading,
	mayEdit,
	onEdit,
	onOpenBoard,
	onNextGuardrails,
}: WorldInspectorProps) {
	if (isLoading && !view) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	if (!view?.world) {
		return (
			<EmptyState
				className="h-full"
				icon={<Globe />}
				title="No world picked"
				description="Pick a world in the Lens strip or the Worlds list to read what it sees."
			/>
		);
	}

	const seen = view.models.filter((m) => m.seen !== "hidden").length;
	const thinks = Object.entries(view.thinks_with);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				size="md"
				icon={<Globe />}
				crumbs={[name ?? view.world.name]}
				chips={
					<Badge variant="outline" size="xs">
						world
					</Badge>
				}
				actions={
					mayEdit ? (
						<Button variant="ghost" size="xs" onClick={onEdit}>
							<Pencil />
							Edit
						</Button>
					) : undefined
				}
			/>

			<Tabs
				size="sm"
				defaultValue="sees"
				className="flex min-h-0 flex-1 flex-col"
			>
				<TabsList className="shrink-0 justify-start border-b px-3">
					<TabsTrigger value="sees">Sees</TabsTrigger>
					<TabsTrigger value="answers">Answers go</TabsTrigger>
					<TabsTrigger value="used">Used by</TabsTrigger>
				</TabsList>

				<TabsContent
					value="sees"
					className="mt-0 min-h-0 flex-1 overflow-y-auto"
				>
					<div className="flex flex-col gap-3 p-3">
						<section className="flex flex-col gap-1">
							<Eyebrow aside={`${seen} of ${view.models.length}`}>
								Models
							</Eyebrow>
							<Legend orientation="column">
								{view.models.map((m) => (
									<LegendItem
										key={m.name}
										color={hue(m.name)}
										label={m.name}
										count={m.seen}
									/>
								))}
							</Legend>
						</section>

						<section className="flex flex-col gap-1">
							<Eyebrow>Window</Eyebrow>
							<PropertyList>
								<PropertyRow label="time" mono>
									{view.window.time ?? "any"}
								</PropertyRow>
								<PropertyRow label="geography" mono>
									{view.window.geo ?? "any"}
								</PropertyRow>
							</PropertyList>
						</section>

						<section className="flex flex-col gap-1">
							<Eyebrow>Thinks with</Eyebrow>
							{thinks.length ? (
								<PropertyList>
									{thinks.map(([role, address]) => (
										<PropertyRow key={role} label={role} mono>
											{address}
										</PropertyRow>
									))}
								</PropertyList>
							) : (
								<p className="text-sm text-muted-foreground">
									No role is cast — each falls through to the plan or the agent.
								</p>
							)}
						</section>

						<section className="flex flex-col gap-1">
							<Eyebrow aside={view.used_by.length}>Used by</Eyebrow>
							<UsedBy view={view} />
						</section>

						<div className="flex flex-wrap items-center gap-2">
							<Button size="sm" variant="outline" onClick={onOpenBoard}>
								Open board
							</Button>
							<Button size="sm" variant="outline" onClick={onNextGuardrails}>
								<ChevronRight />
								Next: guardrails
							</Button>
						</div>
					</div>
				</TabsContent>

				<TabsContent
					value="answers"
					className="mt-0 min-h-0 flex-1 overflow-y-auto"
				>
					<div className="p-3">
						{view.answers_go.length ? (
							<PropertyList labelWidth="auto">
								{view.answers_go.map((d) => (
									<PropertyRow key={d.address} label={d.address} mono>
										{d.may_send === null
											? "closed"
											: d.may_send.length
												? d.may_send.join(" · ")
												: "nothing"}
									</PropertyRow>
								))}
							</PropertyList>
						) : (
							<p className="text-sm text-muted-foreground">
								No model or third party is configured, so no answer leaves the
								Graph.
							</p>
						)}
					</div>
				</TabsContent>

				<TabsContent
					value="used"
					className="mt-0 min-h-0 flex-1 overflow-y-auto"
				>
					<div className="p-3">
						<UsedBy view={view} withRuns />
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function UsedBy({ view, withRuns }: { view: LensView; withRuns?: boolean }) {
	if (!view.used_by.length) {
		return (
			<p className="text-sm text-muted-foreground">
				Nobody has asked under this world yet.
			</p>
		);
	}
	return (
		<PropertyList labelWidth="auto">
			{view.used_by.map((u) => (
				<PropertyRow key={`${u.kind}:${u.id}`} label={u.name} mono>
					{withRuns ? `${u.kind} · ${runs(u.runs)}` : u.kind}
				</PropertyRow>
			))}
		</PropertyList>
	);
}
