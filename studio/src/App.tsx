import { AppLayoutV2 } from "@invana/themes";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Separator,
} from "@invana/ui";
import {
	Database,
	GitGraph,
	LogOut,
	Mail,
	Network,
	UserCircle,
	UserCog,
	Users,
} from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { RoleGate } from "./components/RoleGate";
import { ThemeToggle } from "./components/ThemeToggle";
import { useAuth } from "./hooks/useAuth";

export default function App() {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const { user, displayName, logout, membershipForGraph } = useAuth();

	const isActive = (prefix: string) => pathname.startsWith(prefix);

	// Active Graph comes from the URL (RFC-017): /u/:username/:graphSlug[/...].
	// When off-graph (e.g. /graphs list, /settings/profile), fall back to the
	// user's first graph so the top-right menu's graph-scoped items stay reachable.
	const graphMatch = pathname.match(/^\/u\/([^/]+)\/([^/]+)/);
	const urlMembership = membershipForGraph(graphMatch?.[1], graphMatch?.[2]);
	const fallbackMembership = user?.graphs?.[0] ?? null;
	const activeMembership = urlMembership ?? fallbackMembership;
	const activeRole = activeMembership?.role ?? null;

	// Explorer/Modeller live under /u/:username/:graphSlug/... and only make
	// sense while a Graph is being viewed — show those nav items only when the
	// URL is graph-scoped. The /graphs list page just shows "Graphs".
	const isOnGraphDetail = !!graphMatch;
	const graphScopedPath = isOnGraphDetail
		? `/u/${graphMatch?.[1]}/${graphMatch?.[2]}`
		: null;

	const initial = (user?.first_name ?? "?")[0]?.toUpperCase();

	const topNavItems = [
		{
			name: "Graphs",
			icon: Database,
			tooltipSide: "right" as const,
			className: isActive("/graphs") ? "bg-accent text-accent-foreground" : "",
			onClick: () => navigate("/graphs"),
		},
		...(graphScopedPath
			? [
					{
						name: "Explorer",
						icon: Network,
						tooltipSide: "right" as const,
						showSeperator: true,
						onClick: () => navigate(`${graphScopedPath}/explorer`),
					},
					{
						name: "Modeller",
						icon: GitGraph,
						tooltipSide: "right" as const,
						onClick: () => navigate(`${graphScopedPath}/modeller`),
					},
				]
			: []),
	];

	return (
		<AppLayoutV2
			leftNav={{
				topNavItems,
				bottomNavItems: [
					{
						name: "Profile",
						icon: UserCircle,
						tooltipSide: "right" as const,
						onClick: () => navigate("/settings/profile"),
					},
				],
			}}
			header={{
				className: "!h-[38px]",
				left: (
					<div className="flex items-center gap-2 px-2">
						<span className="font-bold text-xl select-none">Invana Studio</span>
						<Separator orientation="vertical" className="h-4" />
						<span className="text-muted-foreground">
							{activeMembership?.graph_name ??
								(isActive("/graphs") ? "Graphs" : "")}
						</span>
					</div>
				),
				right: (
					<div className="flex items-center gap-1 px-2">
						<ThemeToggle />
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="flex items-center gap-2 h-7"
								>
									<div className="w-5 h-5 rounded-full bg-primary text-primary-foreground font-bold text-base flex items-center justify-center">
										{initial}
									</div>
									<span className="text-base">{displayName}</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuLabel>
									<div className="flex flex-col">
										<span>{displayName}</span>
										<span className="text-base text-muted-foreground font-normal">
											{user?.email}
										</span>
										{user?.username && (
											<span className="text-base text-muted-foreground font-normal">
												@{user.username}
											</span>
										)}
										{activeRole && (
											<span className="text-base text-muted-foreground font-normal mt-1">
												Role: {activeRole}
											</span>
										)}
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => navigate("/settings/profile")}>
									<UserCircle className="w-4 h-4 mr-2" />
									Profile settings
								</DropdownMenuItem>
								{activeMembership && (
									<DropdownMenuItem
										onClick={() =>
											navigate(
												`/u/${activeMembership.owner_username}/${activeMembership.graph_slug}/settings/members`,
											)
										}
									>
										<Users className="w-4 h-4 mr-2" />
										Graph members
									</DropdownMenuItem>
								)}
								{activeMembership && activeRole === "admin" && (
									<DropdownMenuItem
										onClick={() =>
											navigate(
												`/u/${activeMembership.owner_username}/${activeMembership.graph_slug}/settings/invitations`,
											)
										}
									>
										<Mail className="w-4 h-4 mr-2" />
										Invitations
									</DropdownMenuItem>
								)}
								<RoleGate require="superuser">
									<DropdownMenuItem
										onClick={() => {
											window.location.href = "/admin";
										}}
									>
										<UserCog className="w-4 h-4 mr-2" />
										Platform admin
									</DropdownMenuItem>
								</RoleGate>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={async () => {
										await logout();
										navigate("/login", { replace: true });
									}}
								>
									<LogOut className="w-4 h-4 mr-2" />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				),
			}}
			mainSection={{
				content: <Outlet />,
			}}
		/>
	);
}
