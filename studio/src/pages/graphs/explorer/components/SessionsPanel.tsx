import {
	Button,
	ScrollArea,
	SearchInput,
	Spinner,
	TabbedPanel,
} from "@invana/ui";
import { ArrowLeft, Copy, MessageSquare, RotateCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatRelativeTime } from "../../../../lib/time";
import type { QueryLanguage } from "../../../../types/graphs";
import type { LLMProvider } from "../../../../types/llm";
import type { QueryRunPayload } from "../../../../types/query";
import type { Session, SessionMessage } from "../../../../types/session";
import { SessionComposer } from "./SessionComposer";

// How many sessions show before the "MORE" expander kicks in.
const VISIBLE_LIMIT = 8;

export interface SessionsPanelProps {
	// Composer
	availableLanguages: readonly QueryLanguage[];
	defaultLanguage: QueryLanguage;
	llmProviders: readonly LLMProvider[];
	onRun: (payload: QueryRunPayload) => void;
	isRunning: boolean;
	// Sessions
	sessions: Session[];
	activeSession: Session | null;
	onOpenSession: (id: string) => void;
	onBack: () => void;
	/** Re-run a past assistant message's query in place (repaints the canvas). */
	onRerun: (messageId: string) => void;
}

// ── Panel ─────────────────────────────────────────────────────────────────────
// Two views in one TabbedPanel: a list of past sessions, and the threaded
// detail of the active one. The composer is pinned to the footer in both, so
// asking from the list opens a fresh session and drops you into its thread.

export function SessionsPanel({
	availableLanguages,
	defaultLanguage,
	llmProviders,
	onRun,
	isRunning,
	sessions,
	activeSession,
	onOpenSession,
	onBack,
	onRerun,
}: SessionsPanelProps) {
	const [searchOpen, setSearchOpen] = useState(false);
	const [search, setSearch] = useState("");

	const inDetail = activeSession !== null;

	const body = inDetail ? (
		<SessionThread session={activeSession} onBack={onBack} onRerun={onRerun} />
	) : (
		<SessionList
			sessions={sessions}
			search={searchOpen ? search : ""}
			searchOpen={searchOpen}
			onSearchChange={setSearch}
			onOpen={onOpenSession}
		/>
	);

	const composer = (
		<SessionComposer
			availableLanguages={availableLanguages}
			defaultLanguage={defaultLanguage}
			llmProviders={llmProviders}
			onRun={onRun}
			isRunning={isRunning}
		/>
	);

	// Search only makes sense on the list; hide it inside a session.
	const headerActions = inDetail
		? undefined
		: {
				rightNavItems: [
					{
						key: "search",
						name: "Search sessions",
						icon: Search,
						onClick: () => {
							setSearchOpen((v) => !v);
							setSearch("");
						},
					},
				],
			};

	// The composer lives inside the tab content (not TabbedPanel's
	// `footerContent`): the panel sizes its body to `calc(100% - header)` and
	// stacks the footer below that, so a footer would overflow the panel. As a
	// bottom-pinned flex child the body scrolls above and the composer stays put.
	const content = (
		<div className="flex flex-col h-full min-h-0">
			<div className="flex-1 min-h-0">{body}</div>
			<div className="shrink-0">{composer}</div>
		</div>
	);

	return (
		<TabbedPanel
			defaultTab="sessions"
			tabs={[
				{
					value: "sessions",
					label: "Sessions",
					icon: MessageSquare,
					content,
				},
			]}
			headerActions={headerActions}
		/>
	);
}

// ── List view ─────────────────────────────────────────────────────────────────

interface SessionListProps {
	sessions: Session[];
	search: string;
	searchOpen: boolean;
	onSearchChange: (value: string) => void;
	onOpen: (id: string) => void;
}

function SessionList({
	sessions,
	search,
	searchOpen,
	onSearchChange,
	onOpen,
}: SessionListProps) {
	const [expanded, setExpanded] = useState(false);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return sessions;
		return sessions.filter((s) => s.title.toLowerCase().includes(q));
	}, [sessions, search]);

	const shown = expanded ? filtered : filtered.slice(0, VISIBLE_LIMIT);
	const hasMore = filtered.length > VISIBLE_LIMIT;

	return (
		<div className="flex flex-col h-full min-h-0">
			{searchOpen && (
				<div className="p-2 border-b border-border shrink-0">
					<SearchInput value={search} onChange={onSearchChange} />
				</div>
			)}
			<ScrollArea className="flex-1 min-h-0">
				{filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 text-muted-foreground px-6 py-16">
						<MessageSquare className="w-8 h-8 opacity-20" />
						<p className="text-center">
							{sessions.length === 0
								? "No sessions yet. Ask a question below to start one."
								: "No sessions match your search."}
						</p>
					</div>
				) : (
					<div className="flex flex-col py-1">
						{shown.map((session) => (
							<SessionRow
								key={session.id}
								session={session}
								onClick={() => onOpen(session.id)}
							/>
						))}
						{hasMore && (
							<button
								type="button"
								onClick={() => setExpanded((v) => !v)}
								className="flex items-center justify-between px-4 py-2 text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
							>
								<span>{expanded ? "Less" : "More"}</span>
								<span>{filtered.length}</span>
							</button>
						)}
					</div>
				)}
			</ScrollArea>
		</div>
	);
}

function SessionRow({
	session,
	onClick,
}: {
	session: Session;
	onClick: () => void;
}) {
	const last = session.messages[session.messages.length - 1];
	const dotClass =
		last?.status === "error"
			? "bg-destructive"
			: last?.status === "running"
				? "bg-amber-400 animate-pulse"
				: session.nodeCount + session.edgeCount > 0
					? "bg-blue-400"
					: "bg-muted-foreground/40";

	const hasCounts = session.nodeCount + session.edgeCount > 0;

	return (
		<button
			type="button"
			onClick={onClick}
			className="flex items-start gap-2.5 text-left px-4 py-2 hover:bg-accent transition-colors"
		>
			<span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
			<span className="min-w-0 flex-1">
				<span className="block text-foreground truncate">{session.title}</span>
				<span className="flex items-center gap-1.5 text-muted-foreground">
					{hasCounts && (
						<>
							<span className="text-blue-400" title="nodes">
								{session.nodeCount}
							</span>
							<span className="text-purple-400" title="relationships">
								{session.edgeCount}
							</span>
							<span>·</span>
						</>
					)}
					<span>{formatRelativeTime(session.updatedAt)}</span>
				</span>
			</span>
		</button>
	);
}

// ── Detail view ─────────────────────────────────────────────────────────────

interface SessionThreadProps {
	session: Session;
	onBack: () => void;
	onRerun: (messageId: string) => void;
}

function SessionThread({ session, onBack, onRerun }: SessionThreadProps) {
	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Back + title bar — the panel header keeps the persistent "Sessions"
			    tab; this row identifies the session you're inside. */}
			<div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6 shrink-0"
					onClick={onBack}
					title="Back to sessions"
				>
					<ArrowLeft className="w-4 h-4" />
				</Button>
				<span className="uppercase tracking-wide font-medium text-foreground truncate">
					{session.title}
				</span>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="flex flex-col gap-4 p-3">
					{session.messages.map((message) =>
						message.role === "user" ? (
							<UserMessage key={message.id} message={message} />
						) : (
							<AssistantMessage
								key={message.id}
								message={message}
								onRerun={onRerun}
							/>
						),
					)}
				</div>
			</ScrollArea>
		</div>
	);
}

function UserMessage({ message }: { message: SessionMessage }) {
	return (
		<div className="flex justify-end">
			<div className="max-w-[85%] rounded-2xl rounded-br-sm bg-secondary px-3 py-2 text-secondary-foreground whitespace-pre-wrap break-words">
				{message.content}
			</div>
		</div>
	);
}

function AssistantMessage({
	message,
	onRerun,
}: {
	message: SessionMessage;
	onRerun: (messageId: string) => void;
}) {
	const copy = () => {
		navigator.clipboard?.writeText(message.content);
		toast.success("Copied to clipboard");
	};

	if (message.status === "running") {
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Spinner className="w-4 h-4" />
				{message.content}
			</div>
		);
	}

	const meta = [
		message.via,
		message.rowCount != null
			? `${message.rowCount} row${message.rowCount === 1 ? "" : "s"}`
			: null,
		message.executionTimeMs != null ? `${message.executionTimeMs}ms` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className="flex flex-col gap-1">
			<p
				className={`whitespace-pre-wrap break-words ${
					message.status === "error" ? "text-destructive" : "text-foreground"
				}`}
			>
				{message.content}
			</p>
			<div className="flex items-center justify-between text-muted-foreground">
				<div className="flex items-center gap-0.5">
					{message.sourceQuery && (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={() => onRerun(message.id)}
							title="Re-run query"
						>
							<RotateCw className="w-3.5 h-3.5" />
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={copy}
						title="Copy"
					>
						<Copy className="w-3.5 h-3.5" />
					</Button>
				</div>
				{meta && <span>{meta}</span>}
			</div>
		</div>
	);
}
