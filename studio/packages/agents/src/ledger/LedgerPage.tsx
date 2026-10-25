/**
 * **Ledger** — every act by a person or an agent in this Graph, at
 * `/agents/ledger` (the-ledger.md).
 *
 * *As a reviewer, I want the full log — by row, actor, record, refusal —
 * exportable and provably unedited, so that access is proven, not assumed.*
 *
 * The head says the ledger is append-only, when its hash chain last verified
 * (or the row it broke at, in `--destructive`) and how long rows are kept;
 * *Export* opens the Export tab. Five tabs, each the path's last segment:
 *
 * - **Rows** — tiles, preset chips and {@link LedgerRowsTable} with its
 *   drawer (`?row=<id>`).
 * - **By actor** (`?actor=&since=`) · **By record** (`?address=&since=`).
 * - **Refusals** · **Export**.
 *
 * It changes nothing: the ledger is read, never edited. Every number is the
 * engine's.
 */

import { Badge, Button } from "@invana/ui";
import { Download } from "lucide-react";
import { SectionBody, SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import { LedgerActorTab } from "./LedgerActorTab";
import { LedgerExportTab } from "./LedgerExportTab";
import { LedgerRecordTab } from "./LedgerRecordTab";
import { LedgerRefusalsTab } from "./LedgerRefusalsTab";
import { LedgerRowsTab } from "./LedgerRowsTab";
import { clock } from "./ledgerParts";
import { useLedgerIntegrityQuery } from "./queries";
import type { LedgerIntegrity } from "./types";

export function LedgerPage({
	username,
	graphSlug,
	tab,
	onTab,
}: SectionPageProps) {
	const integrity = useLedgerIntegrityQuery(username, graphSlug).data;
	const graph = { username, graphSlug };
	return (
		<SectionPage
			section="ledger"
			tab={tab}
			onTab={onTab}
			chips={<IntegrityChips integrity={integrity} />}
			actions={
				<Button variant="outline" size="sm" onClick={() => onTab("export")}>
					<Download />
					Export
				</Button>
			}
		>
			<SectionBody>
				{tab === "actor" ? (
					<LedgerActorTab {...graph} />
				) : tab === "record" ? (
					<LedgerRecordTab {...graph} />
				) : tab === "refusals" ? (
					<LedgerRefusalsTab {...graph} />
				) : tab === "export" ? (
					<LedgerExportTab {...graph} />
				) : (
					<LedgerRowsTab {...graph} />
				)}
			</SectionBody>
		</SectionPage>
	);
}

/** `append-only` · `hash chain verified 10:20 · 365 days kept`. */
function IntegrityChips({
	integrity,
}: {
	integrity: LedgerIntegrity | undefined;
}) {
	return (
		<>
			<Badge variant="outline" tone="muted" size="xs">
				append-only
			</Badge>
			{integrity &&
				(integrity.ok ? (
					<span className="text-muted-foreground">
						{integrity.verified_at
							? `hash chain verified ${clock(integrity.verified_at)}`
							: "hash chain not checked yet"}{" "}
						· {integrity.retention_days} days kept
					</span>
				) : (
					<span className="text-destructive">
						hash chain broken at row #{integrity.broken_seq ?? "?"} — verified
						at {clock(integrity.verified_at)}
					</span>
				))}
		</>
	);
}
