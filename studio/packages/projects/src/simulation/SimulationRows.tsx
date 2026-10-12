/**
 * **A branch's simulations** — the *Simulations* tab of a branch's page
 * (simulation.md, Branch page *Simulations · N*).
 *
 * Newest first, one row each: `s<n> · <simulator>`, its run's status, when it
 * was opened and — once it has succeeded — the best row and the share of its
 * progeny meeting every target, so the list answers *which bet* without
 * opening anything. A row opens the simulation's result.
 */

import { RecordRow, stepTone } from "@invana-studio/ui";
import { Muted } from "../project/parts";
import { simulationPending, useSimulationsQuery } from "../records/queries";
import { shortDate } from "../records/words";
import type { Project, Simulation } from "../types";
import { pct, rowLabelKey } from "./specForm";

/** `Col-0 × Ler-1 · 41% meet every target` — the best row of a settled simulation. */
function best(s: Simulation): string | null {
	const top = s.result?.ranked[0];
	if (s.status !== "succeeded" || !top) return null;
	const label = rowLabelKey(s.result?.ranked ?? []);
	return `best ${String(top[label] ?? "row 1")} · ${pct(top.meets_all)}% meet every target`;
}

export function SimulationRows({
	project,
	refKey,
	branch,
	onOpen,
}: {
	project: Project;
	refKey: { username: string; graphSlug: string; key: string };
	branch: number;
	onOpen: (n: number) => void;
}) {
	const q = useSimulationsQuery(refKey, branch);
	const items = [...(q.data?.items ?? [])].sort((a, b) => b.number - a.number);
	if (q.isLoading) return <Muted>Reading simulations…</Muted>;
	if (q.error) return <Muted>{(q.error as Error).message}</Muted>;
	if (items.length === 0)
		return (
			<Muted>
				No simulations on this{" "}
				{(project.words?.branch ?? "branch").toLowerCase()} yet — Simulate
				scores crosses before you make them.
			</Muted>
		);
	return (
		<ul>
			{items.map((s) => {
				const status = s.status ?? "queued";
				return (
					<li key={s.number}>
						<RecordRow
							onClick={() => onOpen(s.number)}
							tone={stepTone(status)}
							live={simulationPending(s.status)}
							title={
								<span className="truncate">
									s{s.number} · {s.simulator.title}
								</span>
							}
							subtitle={
								<span className="truncate">
									{[status, shortDate(s.created_at), best(s)]
										.filter(Boolean)
										.join(" · ")}
								</span>
							}
							status={status}
							statusTone={stepTone(status)}
						/>
					</li>
				);
			})}
		</ul>
	);
}
