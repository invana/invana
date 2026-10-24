/**
 * A function › **Contract** — what it takes, what it returns and how each
 * return rolls up on a fan-out, what a plan must order before it, and what it
 * runs as; beside them its calls over 30 days and the skills that need it.
 *
 * The contract is the declaration as the engine serves it, never a second
 * copy. Every number on the tiles is the engine's — Studio formats a count, a
 * time, a rate and the engine's reading of each change, and derives none.
 */

import {
	Badge,
	BoundChip,
	Button,
	MetricGrid,
	MetricTile,
	PropertyList,
	PropertyRow,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	TypographyInlineCode,
} from "@invana/ui";
import { type Change, formatGrouped } from "@invana-studio/core";
import { PanelSection, RecordRow } from "@invana-studio/ui";
import { changeText, changeTone, ms, pct } from "../../overview/fleetParts";
import type { FunctionCalls, FunctionRead } from "../types";

/** How a return reads on a fanned-out step, from the roll-up the engine declares. */
function onFanOut(rollup: string | null | undefined): string {
	if (rollup === "sum") return "summed across lanes";
	if (rollup === "concat") return "concatenated across lanes";
	return "per lane only — bind it inside the lane";
}

/** A declared default as it would be written in a plan. */
function defaultText(value: unknown): string {
	if (value == null) return "—";
	return typeof value === "string" ? value : JSON.stringify(value);
}

/** A tile caption from the engine's change, or what the window before held. */
function caption(change: Change | null, none: string) {
	return change
		? { caption: changeText(change), captionTone: changeTone(change) }
		: { caption: none, captionTone: "muted" as const };
}

export function ContractTab({
	fn,
	onOpenFunction,
	onOpenSkill,
	onOpenPlugin,
}: {
	fn: FunctionRead;
	onOpenFunction?: (key: string) => void;
	onOpenSkill?: (id: string) => void;
	onOpenPlugin?: (name: string) => void;
}) {
	return (
		<div className="grid items-start gap-2.5 p-3.5 @[900px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
			<div className="flex min-w-0 flex-col gap-2.5">
				<Arguments fn={fn} />
				<Returns fn={fn} />
				<MustComeAfter fn={fn} onOpenFunction={onOpenFunction} />
				<RunsAs fn={fn} onOpenPlugin={onOpenPlugin} />
			</div>
			<div className="flex min-w-0 flex-col gap-2.5">
				<CallsTiles calls={fn.calls} />
				<PanelSection
					card
					title="Needed by skills"
					hint={fn.needed_by.length ? `${fn.needed_by.length}` : undefined}
				>
					{fn.needed_by.length === 0 ? (
						<p className="text-muted-foreground">
							No skill's current version names it.
						</p>
					) : (
						fn.needed_by.map((s) => (
							<RecordRow
								key={s.skill_id}
								onClick={
									onOpenSkill ? () => onOpenSkill(s.skill_id) : undefined
								}
								title={s.name}
								status={`v${s.version}`}
							/>
						))
					)}
				</PanelSection>
			</div>
		</div>
	);
}

function Arguments({ fn }: { fn: FunctionRead }) {
	return (
		<PanelSection card title="Arguments" hint={`${fn.args.length}`}>
			{fn.args.length === 0 ? (
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
						{fn.args.map((a) => (
							<TableRow key={a.name}>
								<TableCell>
									<TypographyInlineCode>{a.name}</TypographyInlineCode>
								</TableCell>
								<TableCell className="font-mono">{a.type}</TableCell>
								<TableCell>
									{a.required ? (
										<Badge variant="soft" tone="success" size="xs">
											required
										</Badge>
									) : (
										<span className="text-muted-foreground">optional</span>
									)}
								</TableCell>
								<TableCell className="font-mono">
									{defaultText(a.default)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</PanelSection>
	);
}

function Returns({ fn }: { fn: FunctionRead }) {
	return (
		<PanelSection card title="Returns" hint={`${fn.outputs.length}`}>
			{fn.outputs.length === 0 ? (
				<p className="text-muted-foreground">It returns none.</p>
			) : (
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Type</TableHead>
							<TableHead className="w-full">On a fan-out</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{fn.outputs.map((o) => (
							<TableRow key={o.name}>
								<TableCell>
									<TypographyInlineCode>{o.name}</TypographyInlineCode>
								</TableCell>
								<TableCell className="font-mono">{o.type}</TableCell>
								<TableCell className="text-muted-foreground">
									{onFanOut(o.rollup)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</PanelSection>
	);
}

function MustComeAfter({
	fn,
	onOpenFunction,
}: {
	fn: FunctionRead;
	onOpenFunction?: (key: string) => void;
}) {
	return (
		<PanelSection
			card
			title="Must come after"
			hint={fn.requires.length ? `${fn.requires.length}` : undefined}
		>
			{fn.requires.length === 0 ? (
				<p className="text-muted-foreground">
					Nothing — a plan may place it anywhere.
				</p>
			) : (
				fn.requires.map((r) => (
					<RecordRow
						key={r}
						onClick={onOpenFunction ? () => onOpenFunction(r) : undefined}
						title={<span className="font-mono">{r}</span>}
						subtitle={`A plan naming ${fn.step_key} must already order ${r} before it.`}
					/>
				))
			)}
		</PanelSection>
	);
}

function RunsAs({
	fn,
	onOpenPlugin,
}: {
	fn: FunctionRead;
	onOpenPlugin?: (name: string) => void;
}) {
	const pluginName = fn.plugin.split("@")[0];
	return (
		<PanelSection card title="Runs as">
			<PropertyList>
				<PropertyRow label="Bound">
					<BoundChip bound={fn.bound} />
				</PropertyRow>
				<PropertyRow label="Resources" mono>
					{fn.resources.length ? fn.resources.join(", ") : "none"}
				</PropertyRow>
				{fn.timeout_s != null ? (
					<PropertyRow label="Timeout">{fn.timeout_s} s</PropertyRow>
				) : null}
				{fn.retries != null ? (
					<PropertyRow label="Retries">{fn.retries}</PropertyRow>
				) : null}
				<PropertyRow label="Plugin" mono>
					{onOpenPlugin ? (
						<Button variant="link" onClick={() => onOpenPlugin(pluginName)}>
							{fn.plugin}
						</Button>
					) : (
						fn.plugin
					)}
				</PropertyRow>
				<PropertyRow label="Version" mono>
					v{fn.version} — each run records the version it used
				</PropertyRow>
			</PropertyList>
		</PanelSection>
	);
}

function CallsTiles({ calls }: { calls: FunctionCalls }) {
	const before = `the ${calls.days} days before`;
	return (
		<PanelSection card title={`Calls · ${calls.days} days`}>
			<MetricGrid minTileWidth={110}>
				<MetricTile
					label="Calls"
					value={formatGrouped(calls.calls)}
					{...caption(
						calls.calls_change,
						calls.calls_prior
							? `${formatGrouped(calls.calls_prior)} ${before}`
							: `none ${before}`,
					)}
				/>
				<MetricTile
					label="p95"
					value={ms(calls.p95_ms)}
					{...caption(
						calls.p95_change,
						calls.p95_prior_ms == null
							? `none ${before}`
							: `${ms(calls.p95_prior_ms)} ${before}`,
					)}
				/>
				<MetricTile
					label="Failed"
					value={pct(calls.failed_rate)}
					caption={
						calls.failed_rate_change
							? `${formatGrouped(calls.failed)} · ${changeText(calls.failed_rate_change)}`
							: `${formatGrouped(calls.failed)} failed`
					}
					captionTone={changeTone(calls.failed_rate_change)}
				/>
			</MetricGrid>
		</PanelSection>
	);
}
