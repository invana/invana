import { Button, EmptyState } from "@invana/ui";
import type { ProductLock } from "@invana-studio/core";
import { BoardGround } from "@invana-studio/ui";
import { Lock, Shapes } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * The Explorer on a Graph that cannot answer yet: no question box, only the
 * step that opens it and where that step is taken —
 *
 *   (lock) Asking opens once a model is published
 *   This Graph is connected, but nothing is modelled yet. …
 *   [Open the Modeller]
 *
 * The copy is the product's `gate`, so the lock and the reason it gives are
 * one decision.
 */
export function ExplorerLocked({
	lock,
	graphBase,
}: {
	lock: ProductLock;
	/** `/u/<owner>/<graph>` — the lock's `to` is relative to it. */
	graphBase: string;
}) {
	return (
		<BoardGround data-testid="explorer-locked">
			<EmptyState
				icon={<Lock className="size-6" />}
				title={lock.reason}
				description={lock.detail}
				actions={
					lock.to && lock.action ? (
						<Button asChild size="sm">
							<Link to={`${graphBase}/${lock.to}`}>
								<Shapes />
								{lock.action}
							</Link>
						</Button>
					) : undefined
				}
			/>
		</BoardGround>
	);
}

/** The board before anything is drawn, behind a docked chat. */
export function EmptyBoard() {
	return <BoardGround data-testid="explorer-empty-board" />;
}
