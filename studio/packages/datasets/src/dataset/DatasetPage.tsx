/**
 * **A dataset** — `/datasets/catalogue/<publisher>/<name>` (datasets.md DS-02,
 * boards `datasets.dataset` and its tabs).
 *
 * The header names the dataset and what is true about it — origin, licence,
 * visibility, a retraction — and carries its acts: *Bind to a Graph*, *Share*
 * and *Add observations*. A share or an observation is offered only to who can
 * write the dataset; a bind to anyone who can read it.
 *
 * Each tab is a path level (`provenance`, `records`, `versions`, `conformance`,
 * `used`), so a tab survives a reload; a tab is not a crumb, so switching
 * keeps the trail. The tab's page reads the
 * dataset from the outlet context rather than fetching it again.
 */

import {
	Badge,
	Button,
	ButtonWithTooltip,
	RecordHeader,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@invana/ui";
import { Link2, Pencil, Share2 } from "lucide-react";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { OriginBadge, Page, ReadState } from "../parts";
import { useDatasetQuery, useVersionsQuery } from "../queries";
import { BindDialog } from "./BindDialog";
import {
	type DatasetOutlet,
	datasetPath,
	useCanWrite,
	useDatasetOutlet,
	useDatasetRef,
} from "./context";
import { ObserveDialog } from "./ObserveDialog";
import { ShareDialog } from "./ShareDialog";

const TABS = [
	{ id: "", label: "Overview" },
	{ id: "provenance", label: "Provenance" },
	{ id: "records", label: "Records" },
	{ id: "versions", label: "Versions" },
	{ id: "conformance", label: "Conformance" },
	{ id: "used", label: "Used by" },
] as const;

type Act = "bind" | "share" | "observe" | null;

/** A tab with pages under it hands them the dataset it was handed. */
export function TabOutlet() {
	return <Outlet context={useDatasetOutlet()} />;
}

export function DatasetPage() {
	const ref = useDatasetRef();
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const query = useDatasetQuery(ref);
	const versions = useVersionsQuery(ref);
	const dataset = query.data;
	const canWrite = useCanWrite(dataset);
	const [act, setAct] = useState<Act>(null);

	if (!dataset) {
		return <ReadState loading={query.isLoading} error={query.error} />;
	}

	const base = datasetPath(ref);
	const rest = pathname.slice(base.length).replace(/^\//, "");
	const tab = TABS.find((t) => t.id && rest.startsWith(t.id))?.id ?? "";
	const retracted = (versions.data?.items ?? []).filter((v) => v.retracted);
	const currentRetracted = retracted.find(
		(v) => v.version === dataset.current_version,
	);
	const outlet: DatasetOutlet = { dataset, ref, canWrite };

	return (
		<Page>
			<RecordHeader
				crumbs={[dataset.title || dataset.name]}
				chips={
					<>
						<OriginBadge origin={dataset.origin} />
						{dataset.licence ? (
							<Badge variant="outline" tone="muted" size="xs">
								{dataset.licence}
							</Badge>
						) : null}
						<Badge variant="outline" tone="muted" size="xs">
							{dataset.visibility === "install" ? "shared" : "only me"}
						</Badge>
						{retracted.length ? (
							<Badge variant="soft" tone="destructive" size="xs">
								{retracted.length === 1
									? `v${retracted[0]?.version} retracted`
									: `${retracted.length} versions retracted`}
							</Badge>
						) : null}
					</>
				}
				actions={
					<>
						<ButtonWithTooltip
							variant="outline"
							size="sm"
							disabled={dataset.current_version === null || !!currentRetracted}
							tooltip={
								currentRetracted
									? `v${currentRetracted.version} is retracted; nothing new can bind it.`
									: dataset.current_version === null
										? "Nothing to bind until a first version is imported."
										: "Bind the current version into a Graph's model."
							}
							onClick={() => setAct("bind")}
						>
							<Link2 />
							Bind to a Graph
						</ButtonWithTooltip>
						{canWrite ? (
							<>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setAct("share")}
								>
									<Share2 />
									Share
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setAct("observe")}
								>
									<Pencil />
									Add observations
								</Button>
							</>
						) : null}
					</>
				}
			/>
			<p className="truncate px-4 pt-2 text-sm text-muted-foreground">
				{[
					dataset.address,
					dataset.description,
					dataset.current_version !== null
						? `v${dataset.current_version}`
						: "no version yet",
					`published by ${dataset.publisher}`,
				]
					.filter(Boolean)
					.join(" · ")}
			</p>
			<Tabs
				value={tab}
				onValueChange={(next) => navigate(datasetPath(ref, next))}
			>
				<TabsList className="w-full justify-start gap-1 px-3">
					{TABS.map((t) => (
						<TabsTrigger key={t.id} value={t.id}>
							{t.id === "versions" && versions.data
								? `Versions · ${versions.data.total}`
								: t.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<Outlet context={outlet} />

			<BindDialog
				dataset={dataset}
				open={act === "bind"}
				onClose={() => setAct(null)}
			/>
			{canWrite ? (
				<>
					<ShareDialog
						dataset={dataset}
						open={act === "share"}
						onClose={() => setAct(null)}
					/>
					<ObserveDialog
						dataset={dataset}
						open={act === "observe"}
						onClose={() => setAct(null)}
					/>
				</>
			) : null}
		</Page>
	);
}
