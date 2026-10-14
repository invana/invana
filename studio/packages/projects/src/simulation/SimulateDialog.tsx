/**
 * **Simulate** — run an installed simulator plugin over a branch's pinned
 * dataset versions (simulation.md, board `projects.simulate`).
 *
 * The form is drawn from what the chosen simulator declares, never from its
 * science: one control per spec field, by type — a number for `int`/`float`
 * with its default filled in, text for `str`, a switch for `bool`, JSON for
 * `obj`, and one entry per line for `list` (a line written `trait >= value`,
 * optionally `± sd`, goes as a target). *Reads* starts as every dataset version
 * the branch's findings cite, all ticked, and takes more as
 * `publisher/name@v`. The seed is optional; Invana picks one when it is empty.
 *
 * Opened from the project's header there is no branch yet, so the dialog asks
 * for one first — only a branch that is neither dropped nor merged.
 *
 * **A refusal stays here, in the engine's words**, and nothing opens. A
 * simulation the engine accepts is handed to `onSimulated` and the dialog
 * closes; its result is read on the simulation's own page.
 */

import {
	Checkbox,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
	Textarea,
} from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	useBranchQuery,
	useSimulationMutations,
	useSimulatorsQuery,
} from "../records/queries";
import { parseDatasetRef } from "../records/useProjectRecords";
import { branchLabel } from "../records/words";
import type { Branch, Project, Simulation, SpecField } from "../types";
import {
	buildSpec,
	fieldLabel,
	type SpecDraft,
	specFieldsToDraft,
} from "./specForm";

/** A dataset version as an input takes it — `publisher/name@v` — or null. */
function inputRef(ref: string): string | null {
	const d = parseDatasetRef(ref.trim());
	return d && d.version !== null
		? `${d.publisher}/${d.name}@${d.version}`
		: null;
}

export function SimulateDialog({
	open,
	onClose,
	project,
	refKey,
	branch,
	branches,
	onSimulated,
}: {
	open: boolean;
	onClose: () => void;
	project: Project;
	refKey: { username: string; graphSlug: string; key: string };
	/** The branch it runs on; null asks for one. */
	branch: number | null;
	branches: Branch[];
	onSimulated: (s: Simulation) => void;
}) {
	const simulators = useSimulatorsQuery().data?.items ?? [];
	const { simulate } = useSimulationMutations(refKey);
	const resetSimulate = simulate.reset;

	const [picked, setPicked] = useState<number | null>(branch);
	const [simKey, setSimKey] = useState("");
	const [draft, setDraft] = useState<SpecDraft>({});
	const [reads, setReads] = useState<{ ref: string; on: boolean }[]>([]);
	const [extra, setExtra] = useState("");
	const [seed, setSeed] = useState("");
	const [problem, setProblem] = useState<string | null>(null);

	const simulator =
		simulators.find((s) => `${s.key}@${s.version}` === simKey) ?? null;
	const detail = useBranchQuery(refKey, open ? picked : null);

	// The branch's cited dataset versions, each once.
	const cited = useMemo(() => {
		const out: string[] = [];
		for (const f of detail.data?.findings ?? [])
			for (const c of f.cites) {
				const ref = c.kind === "dataset" ? inputRef(c.ref) : null;
				if (ref && !out.includes(ref)) out.push(ref);
			}
		return out;
	}, [detail.data]);

	// Opening again starts from a fresh form on the caller's branch.
	useEffect(() => {
		if (!open) return;
		setPicked(branch);
		setExtra("");
		setSeed("");
		setProblem(null);
		resetSimulate();
	}, [open, branch, resetSimulate]);

	// The first installed simulator, until the person picks another.
	const firstKey = simulators[0]
		? `${simulators[0].key}@${simulators[0].version}`
		: "";
	useEffect(() => {
		if (open && !simKey && firstKey) setSimKey(firstKey);
	}, [open, simKey, firstKey]);

	// A simulator's own fields, with its defaults, whenever it changes.
	useEffect(() => {
		if (open) setDraft(simulator ? specFieldsToDraft(simulator.spec) : {});
	}, [open, simulator]);

	const citedKey = cited.join(",");
	useEffect(() => {
		if (!open) return;
		setReads(
			citedKey ? citedKey.split(",").map((ref) => ({ ref, on: true })) : [],
		);
	}, [open, citedKey]);

	const pickable = branches.filter(
		(b) => b.status !== "dropped" && b.status !== "merged",
	);
	const onBranch = picked !== null ? branchLabel(project, picked) : null;
	const extraRef = extra.trim() ? inputRef(extra) : null;

	const addRead = () => {
		if (!extraRef) return;
		if (!reads.some((r) => r.ref === extraRef))
			setReads([...reads, { ref: extraRef, on: true }]);
		setExtra("");
	};

	const submit = () => {
		if (!simulator || picked === null) return;
		const built = buildSpec(simulator.spec, draft);
		if (built.error !== undefined) {
			setProblem(built.error);
			return;
		}
		const n = seed.trim() ? Number(seed) : null;
		if (n !== null && !Number.isInteger(n)) {
			setProblem("The seed takes a whole number.");
			return;
		}
		setProblem(null);
		simulate.mutate(
			{
				branch: picked,
				data: {
					simulator: `${simulator.key}@${simulator.version}`,
					spec: built.spec,
					inputs: reads.filter((r) => r.on).map((r) => r.ref),
					seed: n,
				},
			},
			{
				onSuccess: (s) => {
					onSimulated(s);
					onClose();
				},
			},
		);
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Simulate</DialogTitle>
					<DialogDescription>
						{onBranch && detail.data
							? `${onBranch} · ${detail.data.branch.title}`
							: project.name}
					</DialogDescription>
				</DialogHeader>
				<div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto">
					{branch === null ? (
						<div className="flex flex-col gap-1.5">
							<Label>Branch</Label>
							<Select
								value={picked === null ? "" : String(picked)}
								onValueChange={(v) => setPicked(Number(v))}
							>
								<SelectTrigger aria-label="Branch">
									<SelectValue placeholder="The line this simulation informs" />
								</SelectTrigger>
								<SelectContent>
									{pickable.map((b) => (
										<SelectItem key={b.id} value={String(b.number)}>
											{branchLabel(project, b.number)} · {b.title}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					) : null}

					<div className="flex flex-col gap-1.5">
						<Label>Simulator</Label>
						<Select value={simKey} onValueChange={setSimKey}>
							<SelectTrigger aria-label="Simulator">
								<SelectValue placeholder="An installed simulator" />
							</SelectTrigger>
							<SelectContent>
								{simulators.map((s) => (
									<SelectItem
										key={`${s.key}@${s.version}`}
										value={`${s.key}@${s.version}`}
									>
										{s.title} · v{s.version}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-sm text-muted-foreground">
							A plugin does the science; Invana runs it, keeps its inputs and
							labels its output derived.
						</p>
					</div>

					{simulator?.spec.map((f) => (
						<SpecControl
							key={`${simKey}:${f.name}`}
							field={f}
							value={draft[f.name]}
							onChange={(v) => setDraft({ ...draft, [f.name]: v })}
						/>
					))}
					{simulator?.spec.some((f) => f.type === "list") ? (
						<p className="text-sm text-muted-foreground">
							Lists take one entry per line; a target reads trait &gt;= value or
							trait &lt;= value, optionally ± sd.
						</p>
					) : null}

					<div className="flex flex-col gap-1.5">
						<Label>Reads</Label>
						{reads.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No dataset version is cited on this branch — add one below.
							</p>
						) : (
							<ul className="flex flex-col gap-1">
								{reads.map((r) => (
									<li key={r.ref} className="flex items-center gap-2">
										<Checkbox
											id={`read-${r.ref}`}
											checked={r.on}
											onCheckedChange={(on) =>
												setReads(
													reads.map((x) =>
														x.ref === r.ref ? { ...x, on: on === true } : x,
													),
												)
											}
										/>
										<Label
											htmlFor={`read-${r.ref}`}
											className="min-w-0 flex-1 truncate font-mono font-normal"
										>
											{r.ref}
										</Label>
									</li>
								))}
							</ul>
						)}
						<div className="flex gap-2">
							<Input
								aria-label="Another dataset version"
								value={extra}
								onChange={(e) => setExtra(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										addRead();
									}
								}}
								placeholder="publisher/name@v"
							/>
							<Button
								variant="outline"
								size="sm"
								disabled={!extraRef}
								onClick={addRead}
							>
								Add
							</Button>
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="simulation-seed">Seed</Label>
						<Input
							id="simulation-seed"
							type="number"
							value={seed}
							onChange={(e) => setSeed(e.target.value)}
							placeholder="Invana picks one when empty"
						/>
					</div>

					<FormError error={problem ?? (simulate.error as Error | null)} />
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!simulator || picked === null || simulate.isPending}
						onClick={submit}
					>
						<Play />
						{simulate.isPending ? "Starting…" : "Run simulation"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** One spec field's control, chosen by its declared type. */
function SpecControl({
	field,
	value,
	onChange,
}: {
	field: SpecField;
	value: string | boolean | undefined;
	onChange: (v: string | boolean) => void;
}) {
	const id = `spec-${field.name}`;
	const label = `${fieldLabel(field)}${field.required ? "" : " (optional)"}`;
	if (field.type === "bool")
		return (
			<div className="flex items-center gap-2">
				<Switch
					id={id}
					checked={value === true}
					onCheckedChange={(on) => onChange(on)}
				/>
				<Label htmlFor={id}>{label}</Label>
			</div>
		);
	const text = typeof value === "string" ? value : "";
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			{field.type === "list" || field.type === "obj" ? (
				<Textarea
					id={id}
					rows={field.type === "obj" ? 4 : 3}
					className={field.type === "obj" ? "font-mono" : undefined}
					value={text}
					onChange={(e) => onChange(e.target.value)}
					placeholder={field.type === "obj" ? "{ }" : "One per line"}
				/>
			) : (
				<Input
					id={id}
					type={
						field.type === "int" || field.type === "float" ? "number" : "text"
					}
					step={field.type === "float" ? "any" : undefined}
					value={text}
					onChange={(e) => onChange(e.target.value)}
				/>
			)}
		</div>
	);
}
