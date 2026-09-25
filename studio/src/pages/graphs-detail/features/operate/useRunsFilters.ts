/**
 * The journal's chips, shared by the Runs panel and the Runs page (SR70).
 *
 * The page and the list beside it read one query under one set of chips, so
 * the two never show different journals. A filter narrows a list, and a
 * narrowed list is not a place — so it is in memory, not a URL key (G31).
 */

import type { RunsFilters } from "@/hooks/queries/useRuns";
import { create } from "zustand";

interface RunsFiltersState {
	filters: RunsFilters;
	patch: (p: Partial<RunsFilters>) => void;
}

export const useRunsFilters = create<RunsFiltersState>((set) => ({
	filters: {},
	patch: (p) => set((s) => ({ filters: { ...s.filters, ...p } })),
}));
