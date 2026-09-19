import { formatRelativeTime } from "@/lib/time";
import { sessionsListKey } from "@/pages/graphs-detail/features/ask/assistant/useSessions";
import { ListRow } from "@/pages/graphs-detail/shared/ListPanel";
import { requestOpenSession } from "@/pages/graphs-detail/shell/useOpenSessionRequest";
import { sessionsApi } from "@/services/api/sessions";
import type { Session } from "@/types/session";
import {
	Button,
	EmptyState,
	SectionHeader,
	Skeleton,
	StatusDot,
} from "@invana/ui";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";

/** How many rows the panel shows. The assistant holds the rest. */
const LIMIT = 5;

interface Props {
	username: string;
	graphSlug: string;
	/** Hand the right side to the assistant, so a row's session has somewhere to
	 *  open into. */
	onOpenAssistant: () => void;
}

/**
 * The last few sessions, in the graph info panel (graph-detail-page.md G20).
 *
 * It is the third band because it is the honest answer to "what was happening
 * here?" — a graph with three questions asked of it yesterday is a different
 * place from one that has never been asked anything, and a row of counts cannot
 * say that.
 *
 * Reads the assistant's own list through `sessionsListKey`, so the two never
 * disagree and opening the panel costs no extra request when the assistant is
 * already up.
 */
export function RecentSessions({
	username,
	graphSlug,
	onOpenAssistant,
}: Props) {
	const { data, isLoading } = useQuery({
		queryKey: sessionsListKey(username, graphSlug),
		queryFn: () =>
			sessionsApi.list(username, graphSlug, {
				sort: "updated",
				includeArchived: false,
				surface: "explorer",
			}),
		enabled: !!username && !!graphSlug,
	});

	const sessions = data?.items ?? [];
	const shown = sessions.slice(0, LIMIT);

	const open = (id: string) => {
		onOpenAssistant();
		requestOpenSession(id);
	};

	return (
		<section className="rounded-control border border-border">
			<SectionHeader
				title="Recent sessions"
				count={data ? data.total || undefined : undefined}
				actions={
					sessions.length > LIMIT ? (
						<Button
							variant="link"
							size="sm"
							className="h-auto p-0"
							onClick={onOpenAssistant}
						>
							All
						</Button>
					) : undefined
				}
				className="px-3"
			/>
			{isLoading ? (
				<div className="flex flex-col gap-2 p-3">
					<Skeleton className="h-6 w-full" />
					<Skeleton className="h-6 w-4/5" />
				</div>
			) : shown.length === 0 ? (
				<EmptyState
					className="py-8"
					icon={<MessageSquare className="size-7 opacity-20" />}
					title="No sessions yet"
					description="Ask this graph a question and the conversation lands here."
					actions={
						<Button variant="outline" size="sm" onClick={onOpenAssistant}>
							Open the assistant
						</Button>
					}
				/>
			) : (
				<div className="flex flex-col py-1">
					{shown.map((session) => (
						<SessionRow
							key={session.id}
							session={session}
							onClick={() => open(session.id)}
						/>
					))}
				</div>
			)}
		</section>
	);
}

function SessionRow({
	session,
	onClick,
}: {
	session: Session;
	onClick: () => void;
}) {
	const hasCounts = session.nodeCount + session.edgeCount > 0;
	// The same status vocabulary the assistant's own rows use, so a session does
	// not change colour when it changes surface.
	const tone =
		session.lastStatus === "error"
			? "error"
			: session.lastStatus === "running"
				? "running"
				: hasCounts
					? "info"
					: "muted";

	return (
		<ListRow
			onClick={onClick}
			titlePadding="pr-2"
			leading={
				<StatusDot
					tone={tone}
					className="mt-1.5"
					label={session.lastStatus ?? "idle"}
				/>
			}
			title={session.title || "New session"}
			subtitle={
				<>
					{hasCounts && (
						<>
							<span title="nodes">{session.nodeCount}</span>
							<span title="relationships">{session.edgeCount}</span>
							<span>·</span>
						</>
					)}
					<span title="Last updated">
						{formatRelativeTime(session.updatedAt)}
					</span>
				</>
			}
		/>
	);
}
