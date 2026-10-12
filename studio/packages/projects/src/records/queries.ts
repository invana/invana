/**
 * TanStack Query hooks for a project's records — its branches, findings,
 * decisions and proposals, and its report.
 *
 * Every key sits under `["projects", username, graphSlug, key, …]`, so a write
 * to any record re-reads the project it belongs to (the list's counts, the
 * header's balance) along with the record. A decision moves a branch's status
 * and the Graph's decisions list, so a decide also re-reads `["decisions", …]`.
 */

import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { projectsApi, recordsApi, simulationsApi } from "../api";
import type {
	DecisionCreate,
	DerivedDatasetCreate,
	FindingCreate,
	SimulationCreate,
} from "../types";

export interface ProjectRef {
	username: string;
	graphSlug: string;
	key: string;
}

const recordKey = (p: ProjectRef, ...extra: unknown[]) =>
	["projects", p.username, p.graphSlug, p.key, ...extra] as const;

export function useBranchesQuery(p: ProjectRef | null) {
	return useQuery({
		queryKey: p ? recordKey(p, "branches") : ["projects", "none"],
		queryFn: () =>
			recordsApi.branches(
				(p as ProjectRef).username,
				(p as ProjectRef).graphSlug,
				(p as ProjectRef).key,
			),
		enabled: !!p,
	});
}

export function useBranchQuery(p: ProjectRef, n: number | null) {
	return useQuery({
		queryKey: recordKey(p, "branch", n),
		queryFn: () =>
			recordsApi.branch(p.username, p.graphSlug, p.key, n as number),
		enabled: n !== null,
	});
}

/** Every branch's detail — the findings, decisions and proposals of the project. */
export function useBranchDetails(p: ProjectRef, numbers: number[]) {
	return useQueries({
		queries: numbers.map((n) => ({
			queryKey: recordKey(p, "branch", n),
			queryFn: () => recordsApi.branch(p.username, p.graphSlug, p.key, n),
		})),
		combine: (results) => ({
			details: results.flatMap((r) => (r.data ? [r.data] : [])),
			isLoading: results.some((r) => r.isLoading),
		}),
	});
}

export function useFindingQuery(p: ProjectRef, n: number | null) {
	return useQuery({
		queryKey: recordKey(p, "finding", n),
		queryFn: () =>
			recordsApi.finding(p.username, p.graphSlug, p.key, n as number),
		enabled: n !== null,
	});
}

/** Several findings by number — the ones a decision cites. */
export function useFindings(p: ProjectRef, numbers: number[]) {
	return useQueries({
		queries: numbers.map((n) => ({
			queryKey: recordKey(p, "finding", n),
			queryFn: () => recordsApi.finding(p.username, p.graphSlug, p.key, n),
		})),
		combine: (results) => ({
			findings: results.flatMap((r) => (r.data ? [r.data] : [])),
			isLoading: results.some((r) => r.isLoading),
		}),
	});
}

export function useProjectDecisionsQuery(p: ProjectRef) {
	return useQuery({
		queryKey: recordKey(p, "decisions"),
		queryFn: () => recordsApi.decisions(p.username, p.graphSlug, p.key),
	});
}

export function useGraphDecisionsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: ["decisions", username, graphSlug],
		queryFn: () =>
			recordsApi.graphDecisions(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

export function useReportQuery(p: ProjectRef) {
	return useQuery({
		queryKey: recordKey(p, "report"),
		queryFn: () => recordsApi.report(p.username, p.graphSlug, p.key),
	});
}

export function useReportVersionQuery(p: ProjectRef, version: number | null) {
	return useQuery({
		queryKey: recordKey(p, "report", version),
		queryFn: () =>
			recordsApi.reportVersion(
				p.username,
				p.graphSlug,
				p.key,
				version as number,
			),
		enabled: version !== null,
	});
}

/** The people and agents staffed on the project — its access list when private. */
export function useAssignmentsQuery(p: ProjectRef) {
	return useQuery({
		queryKey: recordKey(p, "assignments"),
		queryFn: () => projectsApi.assignments(p.username, p.graphSlug, p.key),
	});
}

/** Each cited dataset once, by `publisher/name`. */
export function useLineageDatasets(refs: string[]) {
	return useQueries({
		queries: refs.map((ref) => {
			const [publisher, name] = ref.split("/");
			return {
				queryKey: ["datasets", "lineage", ref],
				queryFn: () => recordsApi.dataset(publisher, name),
				retry: false,
			};
		}),
		combine: (results) =>
			new Map(
				results.flatMap((r, i) => (r.data ? [[refs[i], r.data] as const] : [])),
			),
	});
}

export function useRecordMutations(p: ProjectRef) {
	const qc = useQueryClient();
	const invalidate = () => {
		// Impact's reach is graph reads, not records: a record write leaves it.
		qc.invalidateQueries({
			queryKey: ["projects", p.username, p.graphSlug],
			predicate: (q) => !q.queryKey.includes("reach"),
		});
		qc.invalidateQueries({ queryKey: ["decisions", p.username, p.graphSlug] });
	};
	const { username, graphSlug, key } = p;
	return {
		fork: useMutation({
			mutationFn: ({ n, titles }: { n: number; titles: string[] }) =>
				recordsApi.fork(username, graphSlug, key, n, titles),
			onSuccess: invalidate,
		}),
		addFinding: useMutation({
			mutationFn: ({ n, data }: { n: number; data: FindingCreate }) =>
				recordsApi.addFinding(username, graphSlug, key, n, data),
			onSuccess: invalidate,
		}),
		review: useMutation({
			mutationFn: (n: number) => recordsApi.review(username, graphSlug, key, n),
			onSuccess: invalidate,
		}),
		decide: useMutation({
			mutationFn: ({ n, data }: { n: number; data: DecisionCreate }) =>
				recordsApi.decide(username, graphSlug, key, n, data),
			onSuccess: invalidate,
		}),
		resolve: useMutation({
			mutationFn: ({ n, act }: { n: number; act: "accept" | "reject" }) =>
				recordsApi.resolveProposal(username, graphSlug, key, n, act),
			onSuccess: invalidate,
		}),
		generate: useMutation({
			mutationFn: () => recordsApi.generate(username, graphSlug, key),
			onSuccess: invalidate,
		}),
		saveDraft: useMutation({
			mutationFn: (draft: string) =>
				recordsApi.saveDraft(username, graphSlug, key, draft),
			onSuccess: invalidate,
		}),
		publish: useMutation({
			mutationFn: () => recordsApi.publish(username, graphSlug, key),
			onSuccess: invalidate,
		}),
	};
}

/** The installed simulators; *Simulate* is drawn only when there is one. */
export function useSimulatorsQuery() {
	return useQuery({
		queryKey: ["simulators"],
		queryFn: () => simulationsApi.simulators(),
		staleTime: 60_000,
	});
}

/** A project's simulations, newest first — one branch's when `branch` is set. */
export function useSimulationsQuery(p: ProjectRef, branch: number | null) {
	return useQuery({
		queryKey: recordKey(p, "simulations", branch),
		queryFn: () => simulationsApi.list(p.username, p.graphSlug, p.key, branch),
	});
}

const SETTLED = new Set(["succeeded", "failed", "cancelled"]);

/** True while the simulation's run has not settled — the result is not in yet. */
export function simulationPending(status: string | null | undefined) {
	return !status || !SETTLED.has(status);
}

/** One simulation, read again every 2 s until its run settles. */
export function useSimulationQuery(p: ProjectRef, n: number | null) {
	return useQuery({
		queryKey: recordKey(p, "simulation", n),
		queryFn: () =>
			simulationsApi.get(p.username, p.graphSlug, p.key, n as number),
		enabled: n !== null,
		refetchInterval: (q) =>
			q.state.data && simulationPending(q.state.data.status) ? 2_000 : false,
	});
}

export function useSimulationMutations(p: ProjectRef) {
	const qc = useQueryClient();
	return {
		simulate: useMutation({
			mutationFn: ({
				branch,
				data,
			}: {
				branch: number;
				data: SimulationCreate;
			}) =>
				simulationsApi.simulate(p.username, p.graphSlug, p.key, branch, data),
			onSuccess: () =>
				qc.invalidateQueries({ queryKey: recordKey(p, "simulations") }),
		}),
		saveAsDataset: useMutation({
			mutationFn: (data: DerivedDatasetCreate) =>
				simulationsApi.saveAsDataset(data),
			onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
		}),
	};
}
