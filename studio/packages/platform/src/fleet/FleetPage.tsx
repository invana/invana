/**
 * Fleet's `mainSection`: the Workers page as the first tab, and the pools and
 * workers opened from it as tabs beside it (`?page=worker_pool:<name>` ·
 * `?page=worker:<name>`). The tab is the path's last segment, `/fleet/<tab>`.
 */
import { PlatformWorkbook, useOpenPlatformRecord } from "@invana-studio/shell";
import { Boxes, Server } from "lucide-react";
import { useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { type FleetOpen, FleetOpenContext } from "./open";
import { FLEET_TABS, type FleetTab, WORKERS } from "./section";
import { WorkerPage } from "./WorkerPage";
import { WorkerPoolPage } from "./WorkerPoolPage";
import { WorkersSectionPage } from "./WorkersSectionPage";

const isTab = (t: string | undefined): t is FleetTab =>
	FLEET_TABS.some((x) => x.key === t);

export function FleetPage() {
	const { tab } = useParams<{ tab: string }>();
	const navigate = useNavigate();
	const openRecord = useOpenPlatformRecord();

	const open = useMemo<FleetOpen>(
		() => ({
			pool: (name) => openRecord("worker_pool", name),
			worker: (name) => openRecord("worker", name),
			tab: (t) => navigate(`/fleet/${t}`),
		}),
		[openRecord, navigate],
	);

	if (!isTab(tab)) return <Navigate to="/fleet/pools" replace />;
	return (
		<FleetOpenContext.Provider value={open}>
			<PlatformWorkbook
				section={{
					id: "workers",
					title: WORKERS.label,
					icon: WORKERS.icon,
					content: <WorkersSectionPage tab={tab} onTab={open.tab} />,
				}}
				records={{
					worker_pool: {
						icon: Boxes,
						render: (name) => (
							<WorkerPoolPage pool={name} onOpenWorker={open.worker} />
						),
					},
					worker: {
						icon: Server,
						render: (name) => (
							<WorkerPage worker={name} onOpenPool={open.pool} />
						),
					},
				}}
			/>
		</FleetOpenContext.Provider>
	);
}
