/**
 * A function's page — `task_type:<key>` in `mainSection`.
 *
 * *As a builder, I want a function's manifest — what it takes, what it
 * returns, what it spends, which version is live and which plans name it —
 * so that a plan step naming it holds no surprises.*
 *
 * The manifest as declared on disk, its arguments and outputs, the plugin
 * that declares it, and how often runs called it in the last 30 days. The
 * registry keeps one manifest version per key, and each run records the
 * version it used, so a run read later still says what it ran.
 *
 * What only a Graph knows comes from that Graph's catalogue entry for the
 * same key: how many reusable plans name it, how each output rolls up on a
 * fan-out, and which functions a plan must order before it. Without a Graph
 * those rows say so rather than guess.
 */

import {
	Button,
	EmptyState,
	PropertyList,
	PropertyRow,
	RecordHeader,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { DetailStatus, PanelSection, RecordRow } from "@invana-studio/ui";
import { useContext } from "react";
import { AgentsOpenContext } from "../open";
import { useCatalogueQuery } from "../plans/queries";
import { useFunctionQuery } from "./queries";

export function FunctionPage({
	taskKey,
	username,
	graphSlug,
	onOpenPlugin,
	onOpenFunction,
}: {
	taskKey: string;
	/** The Graph whose catalogue says who names it; omitted, those rows say so. */
	username?: string;
	graphSlug?: string;
	onOpenPlugin?: (name: string) => void;
	/** Opens a function this one must come after; defaults to the Agents opener. */
	onOpenFunction?: (key: string) => void;
}) {
	const fn = useFunctionQuery(taskKey);
	const catalogue = useCatalogueQuery(username, graphSlug, {
		q: taskKey,
		limit: 50,
	});
	const opener = useContext(AgentsOpenContext);
	const openFunction = onOpenFunction ?? opener?.func;
	const t = fn.data;
	const entry = catalogue.data?.items.find((e) => e.step_key === taskKey);

	if (fn.isLoading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (!t)
		return (
			<EmptyState
				className="h-full"
				title="No such function"
				description={`No loaded plugin declares "${taskKey}". A plan naming it cannot run.`}
			/>
		);

	const pluginName = t.plugin.split("@")[0];
	const args = Object.entries(t.args);
	const outputs = Object.entries(t.outputs);
	const rollupOf = (name: string) =>
		entry?.outputs.find((o) => o.name === name)?.rollup;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				crumbs={["Functions", t.key]}
				chips={
					<>
						<DetailStatus>v{t.version}</DetailStatus>
						<DetailStatus>{t.bound}</DetailStatus>
					</>
				}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto p-3.5">
				<div className="flex flex-col gap-2.5">
					<PanelSection card title="Manifest">
						<PropertyList>
							<PropertyRow label="Does">{t.summary}</PropertyRow>
							<PropertyRow label="Plugin" mono>
								<Button
									variant="link"
									onClick={() => onOpenPlugin?.(pluginName)}
								>
									{t.plugin}
								</Button>
							</PropertyRow>
							<PropertyRow label="Version" mono>
								v{t.version} — each run records the version it used
							</PropertyRow>
							<PropertyRow label="Calls 30d">{t.runs_30d}</PropertyRow>
							<PropertyRow label="Used by">
								{!username || !graphSlug
									? "Open it from a Graph to see the plans naming it"
									: catalogue.isLoading
										? "…"
										: entry?.used_by
											? `${entry.used_by} plan${entry.used_by === 1 ? "" : "s"}`
											: "No plan names it yet"}
							</PropertyRow>
							<PropertyRow label="Side effect">{t.side_effect}</PropertyRow>
							<PropertyRow label="Timeout">
								{t.timeout_s == null
									? "the engine's default"
									: `${t.timeout_s} s`}
							</PropertyRow>
							<PropertyRow label="Retries">
								{t.retries == null ? "the engine's default" : t.retries}
							</PropertyRow>
							<PropertyRow label="Resources" mono>
								{t.resources.length ? t.resources.join(", ") : "none"}
							</PropertyRow>
						</PropertyList>
					</PanelSection>

					<PanelSection card title="Arguments" hint={`${args.length}`}>
						{args.length === 0 ? (
							<p className="text-muted-foreground">
								It takes none — it reads what the run already holds.
							</p>
						) : (
							<Table bordered={false} density="compact">
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Type</TableHead>
										<TableHead>Required</TableHead>
										<TableHead className="w-full">Default</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{args.map(([name, a]) => (
										<TableRow key={name}>
											<TableCell className="font-mono">{name}</TableCell>
											<TableCell className="font-mono">{a.type}</TableCell>
											<TableCell>{a.required ? "yes" : "no"}</TableCell>
											<TableCell className="font-mono">
												{a.default == null ? "—" : JSON.stringify(a.default)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</PanelSection>

					<PanelSection card title="Outputs" hint={`${outputs.length}`}>
						{outputs.length === 0 ? (
							<p className="text-muted-foreground">It returns none.</p>
						) : (
							<PropertyList>
								{outputs.map(([name, type]) => {
									const rollup = rollupOf(name);
									return (
										<PropertyRow key={name} label={name} mono>
											{type}
											{!entry
												? ""
												: rollup
													? ` · ${rollup} across lanes`
													: " · per lane only — bind it inside the lane"}
										</PropertyRow>
									);
								})}
							</PropertyList>
						)}
					</PanelSection>

					<PanelSection
						card
						title="Must come after"
						hint={t.requires.length ? `${t.requires.length}` : undefined}
					>
						{t.requires.length === 0 ? (
							<p className="text-muted-foreground">
								Nothing — a plan may place it anywhere.
							</p>
						) : (
							t.requires.map((r) => (
								<RecordRow
									key={r}
									onClick={openFunction ? () => openFunction(r) : undefined}
									title={<span className="font-mono">{r}</span>}
									subtitle={`A plan naming ${t.key} must already order ${r} before it.`}
								/>
							))
						)}
					</PanelSection>
				</div>
			</div>
		</div>
	);
}
