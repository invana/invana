/** Workers › Workers — every worker across pools, with the state chips. */

import { EmptyState } from "@invana/ui";
import { useState } from "react";
import { useAgentsOpen } from "../open";
import { FleetReadState } from "../overview/fleetParts";
import { StateChips, WorkersTable } from "./parts";
import { useWorkersQuery } from "./queries";

export function WorkersTab() {
	const open = useAgentsOpen();
	const [state, setState] = useState("");
	const workers = useWorkersQuery({ state });

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<StateChips
					counts={workers.data?.counts}
					value={state}
					onChange={setState}
				/>
			</div>
			{workers.data ? (
				<WorkersTable
					page={workers.data}
					showPool
					onOpen={(w) => open.worker(w.name)}
					empty={
						<EmptyState
							title={state ? `No ${state} workers` : "No workers yet"}
							description={
								state
									? "Pick another state, or All."
									: "Add workers to a pool and they list here."
							}
						/>
					}
				/>
			) : (
				<FleetReadState
					loading={workers.isLoading}
					error={workers.error}
					what="the workers"
				/>
			)}
		</>
	);
}
