/**
 * *Open this board* — published by the host, consumed by whatever draws a link
 * to one ([RU13](../../../../../docs/for-developers/modules/skills/features/rules.md)).
 *
 * A statement in a trace links to its rule's board, and the surfaces that draw
 * one sit at very different depths: the activity tree is two components under a
 * panel the host already hands a callback to, and the trace dialog is five
 * under an assistant turn. Threading a prop the whole way would put
 * `onOpenRule` on every component in between, none of which has any use for it
 * — the same problem `Save report` answers one level down with
 * [`DeclaredBoardContext`](./useReport.ts) ([B20](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * **Only the kinds that bind to a record and read no trace.** `run` and
 * `task_run` both need a `runId` this signature cannot carry
 * ([SD3](../../../../../docs/for-developers/building-studio/skills-dashboards.md)),
 * and a context that let them through would be a board opened without the one
 * thing its body checks for ([B17](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 */

import { createContext, useContext } from "react";

/** A declared kind whose whole address is its subject. */
export type RecordBoardKind =
	| "skill"
	| "skill_usage"
	| "rule"
	| "world"
	| "guardrail";

export type OpenBoardFn = (kind: RecordBoardKind, subjectId: string) => void;

export const OpenBoardContext = createContext<OpenBoardFn | null>(null);

/**
 * How to open a record's board, or `null` outside the host.
 *
 * A surface with nowhere to open one draws its statements as text rather than
 * as a link that fails (RU13).
 */
export function useOpenBoard(): OpenBoardFn | null {
	return useContext(OpenBoardContext);
}
