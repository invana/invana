/**
 * A dataset's **Used by** (board `datasets.dataset.used`, DS-03): one list of
 * the Graphs of yours that bound it and the datasets derived from it, every
 * version together, each row naming the version it cites (`v2 · behind`) —
 * so a result can be traced back to the exact data.
 */

import { Spinner } from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { PageBody } from "../parts";
import { useVersionsQuery } from "../queries";
import { useDatasetOutlet } from "./context";
import { Downstream } from "./Downstream";

export function UsedByTab() {
	const { ref, dataset } = useDatasetOutlet();
	const versions = useVersionsQuery(ref);
	const items = [...(versions.data?.items ?? [])].sort(
		(a, b) => b.version - a.version,
	);
	const anyRetracted = items.some((v) => v.retracted);

	return (
		<PageBody>
			{versions.isLoading ? <Spinner /> : null}
			{!versions.isLoading && !items.length ? (
				<p className="text-sm text-muted-foreground">
					Nothing can use this dataset until its first version is imported.
				</p>
			) : null}
			{items.length ? (
				<PanelSection
					card
					title="Used by"
					hint={
						anyRetracted
							? "rows citing a retracted version are flagged"
							: undefined
					}
				>
					<Downstream
						address={dataset.address}
						versions={items.map((v) => v.version)}
					/>
				</PanelSection>
			) : null}
		</PageBody>
	);
}
