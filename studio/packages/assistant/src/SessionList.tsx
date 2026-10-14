import { Button, ScrollArea, StatusDot } from "@invana/ui";
import type { Session } from "@invana-studio/core";
import { formatRelativeTime } from "@invana-studio/core";
import { ListRow } from "@invana-studio/ui";
import { Archive, ArchiveRestore, MessageSquare, Pin } from "lucide-react";
import { useMemo } from "react";

export interface SessionListProps {
	sessions: Session[];
	search: string;
	onOpen: (id: string) => void;
	onPin: (id: string, pinned: boolean) => void;
	onArchive: (id: string, archived: boolean) => void;
}

/**
 * The assistant's history: every session on the Graph, newest first,
 * filtered by the search above it. A row is its outcome's dot, its title, and
 * when it was last touched — with *failed* when its last reply did:
 *
 *   ● Which routes out of LHR are growing?
 *     today
 *   ● total number of countries?
 *     2 days ago · failed
 *
 * Pin and archive reveal on hover; a pinned row keeps its pin.
 */
export function SessionList({
	sessions,
	search,
	onOpen,
	onPin,
	onArchive,
}: SessionListProps) {
	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return q
			? sessions.filter((s) => s.title.toLowerCase().includes(q))
			: sessions;
	}, [sessions, search]);

	if (filtered.length === 0)
		return (
			<div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-muted-foreground">
				<MessageSquare className="size-8 opacity-20" />
				<p className="text-center">
					{sessions.length === 0
						? "No sessions yet. Ask a question below to start one."
						: "No sessions match your search."}
				</p>
			</div>
		);

	return (
		<ScrollArea className="h-full">
			<div className="flex flex-col py-1">
				{filtered.map((session) => (
					<SessionRow
						key={session.id}
						session={session}
						onClick={() => onOpen(session.id)}
						onPin={onPin}
						onArchive={onArchive}
					/>
				))}
			</div>
		</ScrollArea>
	);
}

function SessionRow({
	session,
	onClick,
	onPin,
	onArchive,
}: {
	session: Session;
	onClick: () => void;
	onPin: (id: string, pinned: boolean) => void;
	onArchive: (id: string, archived: boolean) => void;
}) {
	// List summaries carry no messages, so the outcome is the engine's
	// denormalized `lastStatus`; a freshly sent session reads its last message.
	const status =
		session.lastStatus ?? session.messages[session.messages.length - 1]?.status;
	const failed = status === "error";

	return (
		<ListRow
			onClick={onClick}
			titlePadding={`group-hover:pr-12 ${session.pinned ? "pr-8" : "pr-2"}`}
			leading={
				<StatusDot
					className="mt-1.5"
					tone={
						failed
							? "error"
							: status === "running"
								? "running"
								: status
									? "success"
									: "muted"
					}
				/>
			}
			title={session.title || "New session"}
			subtitle={
				<span>
					{formatRelativeTime(session.updatedAt)}
					{failed && " · failed"}
				</span>
			}
			actions={
				<>
					<Button
						variant="ghost"
						size="icon"
						className={`h-6 w-6 ${
							session.pinned
								? "text-foreground"
								: "text-muted-foreground opacity-0 group-hover:opacity-100"
						}`}
						onClick={(e) => {
							e.stopPropagation();
							onPin(session.id, !session.pinned);
						}}
						title={session.pinned ? "Unpin" : "Pin"}
					>
						<Pin
							className={`w-3.5 h-3.5 ${session.pinned ? "fill-current" : ""}`}
						/>
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100"
						onClick={(e) => {
							e.stopPropagation();
							onArchive(session.id, !session.archived);
						}}
						title={session.archived ? "Unarchive" : "Archive"}
					>
						{session.archived ? (
							<ArchiveRestore className="w-3.5 h-3.5" />
						) : (
							<Archive className="w-3.5 h-3.5" />
						)}
					</Button>
				</>
			}
		/>
	);
}
