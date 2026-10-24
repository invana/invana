/**
 * A plugin's page — `plugin:<name>` in `mainSection`, the Plugins stack
 * beside it.
 *
 * *As a builder, I want one plugin in full — the functions it declares, the
 * skills and plans it brings, and whether it may run — so that I know what a
 * plan gets by naming its functions.*
 *
 * A record header with the plugin's kind, state, version and function count,
 * then two columns: its functions (each opens `task_type:<key>`) and the
 * skills it brings on the left; what it needs to run — the pip extra and the
 * secret names a worker may resolve — and the plans it brings on the right.
 * Enable and Disable act only on a plugin the engine marks `switchable`, and
 * only for an install Admin — anyone else sees the act drawn disabled,
 * naming the role; a core plugin always runs.
 */

import {
	BoundChip,
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
	TypographyInlineCode,
} from "@invana/ui";
import { DetailStatus, FormError, PanelSection } from "@invana-studio/ui";
import { useContext } from "react";
import { AgentsOpenContext } from "../open";
import { SECTIONS } from "../sections/spec";
import { PluginStateChip, PluginToggle } from "./PluginToggle";
import { usePluginQuery, useSetPluginEnabledMutation } from "./queries";

export function PluginPage({
	name,
	onOpenFunction,
}: {
	name: string;
	onOpenFunction?: (key: string) => void;
}) {
	const plugin = usePluginQuery(name);
	const toggle = useSetPluginEnabledMutation(name);
	const opener = useContext(AgentsOpenContext);
	const p = plugin.data;
	const Icon = SECTIONS.functions.icon;

	if (plugin.isLoading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (!p)
		return (
			<EmptyState
				className="h-full"
				title="This plugin is not in the registry"
				description="It may have been uninstalled. Close this page, or pick a plugin in Plugins."
			/>
		);

	const functions = p.task_types.length;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				icon={<Icon />}
				crumbs={[
					opener
						? {
								label: SECTIONS.functions.label,
								onClick: () => opener.section("functions", "plugins"),
							}
						: SECTIONS.functions.label,
					p.name,
				]}
				chips={
					<>
						<DetailStatus>{p.kind}</DetailStatus>
						<PluginStateChip plugin={p} />
						<span className="text-sm text-muted-foreground">
							v{p.version} · {functions}{" "}
							{functions === 1 ? "function" : "functions"}
						</span>
					</>
				}
				actions={
					<PluginToggle
						plugin={p}
						toggle={toggle}
						variant={p.enabled ? "ghost" : "default"}
					/>
				}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto p-3.5">
				<div className="flex flex-col gap-2.5">
					<FormError error={toggle.error} />
					{p.title ? <p>{p.title}</p> : null}
					{!p.installed ? (
						<p className="text-muted-foreground">
							Not installed — the <span className="font-mono">{p.extra}</span>{" "}
							extra brings its functions.
						</p>
					) : null}

					<div className="grid items-start gap-2.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
						<div className="flex min-w-0 flex-col gap-2.5">
							<PanelSection card title="Functions">
								{functions === 0 ? (
									<p className="text-muted-foreground">It declares none.</p>
								) : (
									<Table bordered={false} density="compact">
										<TableHeader>
											<TableRow>
												<TableHead>Function</TableHead>
												<TableHead className="w-full">What it does</TableHead>
												<TableHead>Version</TableHead>
												<TableHead>Bound</TableHead>
												<TableHead className="whitespace-nowrap">
													Side effect
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{p.task_types.map((t) => (
												<TableRow
													key={t.key}
													className="cursor-pointer"
													onClick={() => onOpenFunction?.(t.key)}
												>
													<TableCell className="whitespace-nowrap">
														<TypographyInlineCode>{t.key}</TypographyInlineCode>
													</TableCell>
													<TableCell>{t.summary}</TableCell>
													<TableCell className="whitespace-nowrap">
														v{t.version}
													</TableCell>
													<TableCell>
														<BoundChip bound={t.bound} />
													</TableCell>
													<TableCell>{t.side_effect}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								)}
							</PanelSection>

							<PanelSection card title="Skills it brings">
								{p.skills.length === 0 ? (
									<p className="text-muted-foreground">It brings none.</p>
								) : (
									<PropertyList labelWidth="auto">
										{p.skills.map((s) => (
											<PropertyRow
												key={s.slug}
												label={`${s.name} v${s.version}`}
											>
												{s.when_to_use || s.description}
											</PropertyRow>
										))}
									</PropertyList>
								)}
							</PanelSection>
						</div>

						<div className="flex min-w-0 flex-col gap-2.5">
							<PanelSection card title="To run">
								<PropertyList>
									<PropertyRow label="Extra" mono>
										{p.extra || "none — it ships with the engine"}
									</PropertyRow>
									<PropertyRow label="Secrets" mono>
										{p.secrets.length ? p.secrets.join(", ") : "none"}
									</PropertyRow>
								</PropertyList>
							</PanelSection>

							<PanelSection card title="Plans">
								{p.flows.length === 0 ? (
									<p className="text-muted-foreground">It brings none.</p>
								) : (
									<PropertyList labelWidth="auto">
										{p.flows.map((f) => (
											<PropertyRow
												key={f.key}
												label={
													<span className="font-mono">
														{f.key}@{f.version}
													</span>
												}
											>
												{f.description}
											</PropertyRow>
										))}
									</PropertyList>
								)}
							</PanelSection>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
