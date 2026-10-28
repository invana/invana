/**
 * The Govern panel — the leftSection of the Worlds and Guardrails pages.
 *
 * ```
 * Model   Worlds   Guardrails
 * [ Filter types… ]
 * MODELS                              4 · 10 stitches
 * ● AirRoutes                                     v2
 *   ● airport                                15 props
 *   ● route                                      edge
 * WORLDS                                          4  +
 * ● EU · H1 2026                              lens on
 * GUARDRAILS                                      6  +
 * ● Deal.price never leaves                  2 types
 * ```
 *
 * **Model** goes to the Modeller's global model; **Worlds** and
 * **Guardrails** switch the page (`?section=`). The filter narrows the types
 * listed under each model. A world row picks the world the lens canvas reads
 * (`?world=`), and the one on screen says *lens on*; a guardrail row opens its
 * inspector (`?guardrail=`).
 *
 * *New world* and *New rule* are the modeller's: without the role they are
 * absent and a line says who may edit. Every count is the engine's — the
 * models and stitches from the global model, the worlds and guardrails from
 * their lists' `total`, a guardrail's types from its row.
 */

import {
	Button,
	SearchInput,
	SectionHeader,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@invana/ui";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OutlineRow } from "../../models/model-editor/components/OutlineRow";
import { modelPagePath } from "../../models/model-page/useModelsView";
import { useGlobalModelQuery } from "../../models/queries";
import { useAllModels } from "../../models/stitch/useAllModels";
import { RuleDialog } from "../guardrails/RuleDialog";
import { WorldDialog } from "../pages/WorldDialog";
import { useShownWorld } from "../pages/WorldsPage";
import { useGuardrailsQuery } from "../queries";
import { useLensesViewPanel } from "../useLensesViewPanel";

export interface GovernViewPanelProps {
	username?: string;
	graphSlug?: string;
}

const MODEL_TAB = "model";

export function GovernViewPanel({ username, graphSlug }: GovernViewPanelProps) {
	if (!username || !graphSlug) return null;
	return <GovernPanel username={username} graphSlug={graphSlug} />;
}

function GovernPanel({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const navigate = useNavigate();
	const govern = useLensesViewPanel();
	const [filter, setFilter] = useState("");
	const [adding, setAdding] = useState<"world" | "rule" | null>(null);

	const { frames } = useAllModels(username, graphSlug);
	const union = useGlobalModelQuery(username, graphSlug);
	const {
		worldId,
		worlds,
		total: worldsTotal,
	} = useShownWorld(username, graphSlug);
	const guardrails = useGuardrailsQuery(username, graphSlug);
	const mayEdit = !!guardrails.data?.may_edit;

	const needle = filter.trim().toLowerCase();
	const models = useMemo(
		() =>
			frames
				.map((f) => ({
					frame: f,
					types: [
						...f.nodeTypes.map((t) => ({
							name: t.name,
							meta: `${t.property_mappings?.length ?? 0} props`,
						})),
						...f.edgeTypes.map((t) => ({ name: t.name, meta: "edge" })),
					].filter((t) => !needle || t.name.toLowerCase().includes(needle)),
				}))
				.filter((m) => !needle || m.types.length > 0),
		[frames, needle],
	);

	const modelsCount = union.data
		? `${union.data.model_count} · ${union.data.link_count} stitches`
		: undefined;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<Tabs
				size="sm"
				value={govern.sectionKey}
				onValueChange={(v) => {
					if (v === MODEL_TAB)
						navigate(`/u/${username}/${graphSlug}/modeller/global-model`);
					else govern.focus(v as "worlds" | "guardrails");
				}}
			>
				<TabsList className="w-full justify-start border-b px-3">
					<TabsTrigger value={MODEL_TAB}>Model</TabsTrigger>
					<TabsTrigger value="worlds">Worlds</TabsTrigger>
					<TabsTrigger value="guardrails">Guardrails</TabsTrigger>
				</TabsList>
			</Tabs>

			<div className="shrink-0 p-3">
				<SearchInput
					inputSize="sm"
					value={filter}
					onChange={setFilter}
					placeholder="Filter types…"
					aria-label="Filter types"
				/>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto pb-3">
				<section>
					<SectionHeader bare title="Models" count={modelsCount} />
					{models.map(({ frame, types }) => (
						<div key={frame.modelId}>
							<OutlineRow
								name={frame.name}
								meta={frame.versionLabel ? `v${frame.versionLabel}` : "draft"}
								tone="info"
								onClick={() =>
									navigate(modelPagePath(username, graphSlug, frame.modelId))
								}
							/>
							<div className="pl-3">
								{types.map((t) => (
									<OutlineRow
										key={t.name}
										name={t.name}
										meta={t.meta}
										onClick={() =>
											navigate(
												modelPagePath(username, graphSlug, frame.modelId, {
													type: t.name,
												}),
											)
										}
									/>
								))}
							</div>
						</div>
					))}
					{needle && !models.length ? (
						<p className="px-3 text-sm text-muted-foreground">
							No type matches “{filter}”.
						</p>
					) : null}
				</section>

				<section>
					<SectionHeader
						bare
						title="Worlds"
						count={worldsTotal}
						actions={
							mayEdit ? (
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label="New world"
									onClick={() => setAdding("world")}
								>
									<Plus />
								</Button>
							) : undefined
						}
					/>
					{worlds.length ? (
						worlds.map((w) => (
							<OutlineRow
								key={w.id}
								name={w.display_name}
								meta={w.id === worldId ? "lens on" : undefined}
								tone={w.id === worldId ? "success" : "muted"}
								active={w.id === worldId && govern.sectionKey === "worlds"}
								onClick={() => govern.openWorld(w.id)}
							/>
						))
					) : (
						<p className="px-3 text-sm text-muted-foreground">
							No worlds yet — a question sees the whole model, inside the
							guardrails.
						</p>
					)}
				</section>

				<section>
					<SectionHeader
						bare
						title="Guardrails"
						count={guardrails.data?.total}
						actions={
							mayEdit ? (
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label="New rule"
									onClick={() => setAdding("rule")}
								>
									<Plus />
								</Button>
							) : undefined
						}
					/>
					{guardrails.data?.items.length ? (
						guardrails.data.items.map((g) => (
							<OutlineRow
								key={g.id}
								name={g.name}
								meta={`${g.types} ${g.types === 1 ? "type" : "types"}`}
								tone="warning"
								active={
									g.id === govern.guardrailId &&
									govern.sectionKey === "guardrails"
								}
								onClick={() => govern.openGuardrail(g.id)}
							/>
						))
					) : guardrails.data ? (
						<p className="px-3 text-sm text-muted-foreground">
							No guardrails — every property may be read and may leave.
						</p>
					) : null}
				</section>

				{guardrails.data && !mayEdit ? (
					<p className="px-3 pt-3 text-sm text-muted-foreground">
						Worlds and guardrails are edited by a member with the modeller role.
					</p>
				) : null}
			</div>

			<WorldDialog
				username={username}
				graphSlug={graphSlug}
				open={adding === "world"}
				lens={null}
				onClose={() => setAdding(null)}
				onSaved={(id) => govern.openWorld(id)}
			/>
			<RuleDialog
				username={username}
				graphSlug={graphSlug}
				open={adding === "rule"}
				guardrail={null}
				onClose={() => setAdding(null)}
				onSaved={(id) => govern.openGuardrail(id)}
			/>
		</div>
	);
}
