/**
 * **Workers** — pools of workers that run every agent's steps, at
 * `/agents/workers`. Four tabs: Pools · Workers · Capacity · Join tokens.
 *
 * *Add workers* opens the five-step modal whose step is `?add=`. Workers are
 * install-wide; members read, install admins add, drain and revoke.
 */

import { useUpdateSearchParams } from "@invana-studio/core";
import { DetailStatus } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { SectionBody, SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import {
	ADD_STEPS,
	type AddStep,
	AddWorkersModal,
	parseAddStep,
} from "./AddWorkersModal";
import { CapacityTab } from "./CapacityTab";
import { PoolsTab } from "./PoolsTab";
import { AdminButton } from "./parts";
import { useOverviewQuery, usePoolsQuery } from "./queries";
import { TokensTab } from "./TokensTab";
import { WorkersTab } from "./WorkersTab";

const ADD_PARAM = "add";

export function WorkersSectionPage({ tab, onTab }: SectionPageProps) {
	const [search] = useSearchParams();
	const update = useUpdateSearchParams();
	const step = parseAddStep(search.get(ADD_PARAM));
	const overview = useOverviewQuery();
	const pools = usePoolsQuery();

	const setStep = (next: AddStep | null) =>
		update((params) => {
			if (next) params.set(ADD_PARAM, next);
			else params.delete(ADD_PARAM);
			return params;
		});
	const add = () => setStep(ADD_STEPS[0]);

	const totals = overview.data?.totals;
	return (
		<SectionPage
			section="workers"
			tab={tab}
			onTab={onTab}
			chips={
				totals && pools.data ? (
					<DetailStatus>{`${pools.data.total} pools · ${totals.workers} workers`}</DetailStatus>
				) : null
			}
			actions={
				<AdminButton onClick={add}>
					<Plus />
					Add workers
				</AdminButton>
			}
		>
			<SectionBody>
				{tab === "workers" ? (
					<WorkersTab />
				) : tab === "capacity" ? (
					<CapacityTab onAdd={add} />
				) : tab === "tokens" ? (
					<TokensTab />
				) : (
					<PoolsTab onAdd={add} />
				)}
			</SectionBody>
			{step ? (
				<AddWorkersModal
					step={step}
					onStep={setStep}
					onClose={() => setStep(null)}
				/>
			) : null}
		</SectionPage>
	);
}
