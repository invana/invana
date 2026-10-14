/**
 * A plugin's page — `plugin:<name>` in `mainSection`, the Plugins stack
 * beside it.
 *
 * *As a builder, I want one plugin in full — the task types it declares, the
 * skills and flows it brings, and whether it may run — so that I know what a
 * plan gets by naming its task types.*
 *
 * A record header with the plugin's kind, version and state, then its task
 * types (each opens `task_type:<key>`), its skills, its flows, and what it
 * needs to run: the pip extra and the secret names a worker may resolve.
 * Enable and Disable are offered only on a plugin the engine marks
 * `switchable`, and only to an install Admin; a core plugin always runs.
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
import { useAuth } from "@invana-studio/core";
import { DetailStatus, FormError, PanelSection } from "@invana-studio/ui";
import { usePluginQuery, useSetPluginEnabledMutation } from "./queries";

export function PluginPage({
	name,
	onOpenTaskType,
}: {
	name: string;
	onOpenTaskType?: (key: string) => void;
}) {
	const plugin = usePluginQuery(name);
	const toggle = useSetPluginEnabledMutation(name);
	const { isSuperuser } = useAuth();
	const p = plugin.data;

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

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				crumbs={["Plugins", p.name]}
				chips={
					<>
						<DetailStatus>{p.kind}</DetailStatus>
						<DetailStatus>v{p.version}</DetailStatus>
						<DetailStatus>
							{!p.installed
								? "not installed"
								: p.restart_required
									? "restart to load"
									: p.enabled
										? "enabled"
										: "disabled"}
						</DetailStatus>
					</>
				}
				actions={
					p.switchable && p.installed && isSuperuser ? (
						<Button
							size="sm"
							variant={p.enabled ? "ghost" : "default"}
							disabled={toggle.isPending}
							onClick={() => toggle.mutate(!p.enabled)}
						>
							{p.enabled ? "Disable" : "Enable"}
						</Button>
					) : null
				}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto p-3.5">
				<div className="flex flex-col gap-2.5">
					<FormError error={toggle.error} />
					{p.title ? <p>{p.title}</p> : null}
					{!p.installed ? (
						<p className="text-muted-foreground">
							Not installed — the <span className="font-mono">{p.extra}</span>{" "}
							extra brings its task types.
						</p>
					) : null}

					<PanelSection card title="Task types" hint={`${p.task_types.length}`}>
						{p.task_types.length === 0 ? (
							<p className="text-muted-foreground">It declares none.</p>
						) : (
							<Table bordered={false} density="compact">
								<TableHeader>
									<TableRow>
										<TableHead>Key</TableHead>
										<TableHead>Version</TableHead>
										<TableHead>Bound</TableHead>
										<TableHead>Side effect</TableHead>
										<TableHead className="w-full">What it does</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{p.task_types.map((t) => (
										<TableRow
											key={t.key}
											className="cursor-pointer"
											onClick={() => onOpenTaskType?.(t.key)}
										>
											<TableCell className="font-mono">{t.key}</TableCell>
											<TableCell>v{t.version}</TableCell>
											<TableCell>{t.bound}</TableCell>
											<TableCell>{t.side_effect}</TableCell>
											<TableCell>{t.summary}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</PanelSection>

					<PanelSection card title="Skills" hint={`${p.skills.length}`}>
						{p.skills.length === 0 ? (
							<p className="text-muted-foreground">It brings none.</p>
						) : (
							<PropertyList>
								{p.skills.map((s) => (
									<PropertyRow key={s.slug} label={`${s.name} · v${s.version}`}>
										{s.when_to_use || s.description}
									</PropertyRow>
								))}
							</PropertyList>
						)}
					</PanelSection>

					<PanelSection card title="Flows" hint={`${p.flows.length}`}>
						{p.flows.length === 0 ? (
							<p className="text-muted-foreground">It brings none.</p>
						) : (
							<PropertyList>
								{p.flows.map((f) => (
									<PropertyRow key={f.key} label={`${f.key}@${f.version}`} mono>
										{f.description}
									</PropertyRow>
								))}
							</PropertyList>
						)}
					</PanelSection>

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
				</div>
			</div>
		</div>
	);
}
