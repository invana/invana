/**
 * A task type's page — `task_type:<key>` in `mainSection`.
 *
 * *As a builder, I want a task type's manifest — what it takes, what it
 * returns, what it spends and which version is live — so that a plan step
 * naming it holds no surprises.*
 *
 * The manifest as declared on disk, its arguments and outputs, the plugin
 * that declares it, and how often runs named it in the last 30 days. The
 * registry keeps one manifest version per key, and each run records the
 * version it used, so a run read later still says what it ran.
 */

import {
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
import { DetailStatus, PanelSection } from "@invana-studio/ui";
import { useTaskTypeQuery } from "./queries";

export function TaskTypePage({
	taskKey,
	onOpenPlugin,
}: {
	taskKey: string;
	onOpenPlugin?: (name: string) => void;
}) {
	const tt = useTaskTypeQuery(taskKey);
	const t = tt.data;

	if (tt.isLoading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (!t)
		return (
			<EmptyState
				className="h-full"
				title="No such task type"
				description={`No loaded plugin declares "${taskKey}". A plan naming it cannot run.`}
			/>
		);

	const pluginName = t.plugin.split("@")[0];
	const args = Object.entries(t.args);
	const outputs = Object.entries(t.outputs);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				crumbs={["Plugins", pluginName, t.key]}
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
								<button
									type="button"
									className="hover:text-primary"
									onClick={() => onOpenPlugin?.(pluginName)}
								>
									{t.plugin}
								</button>
							</PropertyRow>
							<PropertyRow label="Version" mono>
								v{t.version} — each run records the version it used
							</PropertyRow>
							<PropertyRow label="Runs, 30 days">{t.runs_30d}</PropertyRow>
							<PropertyRow label="Side effect">{t.side_effect}</PropertyRow>
							<PropertyRow label="Timeout">
								{t.timeout_s == null
									? "the engine's default"
									: `${t.timeout_s} s`}
							</PropertyRow>
							<PropertyRow label="Retries">
								{t.retries == null ? "the engine's default" : t.retries}
							</PropertyRow>
							<PropertyRow label="Requires" mono>
								{t.requires.length ? t.requires.join(", ") : "nothing"}
							</PropertyRow>
							<PropertyRow label="Resources" mono>
								{t.resources.length ? t.resources.join(", ") : "none"}
							</PropertyRow>
						</PropertyList>
					</PanelSection>

					<PanelSection card title="Arguments" hint={`${args.length}`}>
						{args.length === 0 ? (
							<p className="text-muted-foreground">It takes none.</p>
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
								{outputs.map(([name, type]) => (
									<PropertyRow key={name} label={name} mono>
										{type}
									</PropertyRow>
								))}
							</PropertyList>
						)}
					</PanelSection>
				</div>
			</div>
		</div>
	);
}
