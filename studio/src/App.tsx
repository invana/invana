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
	Settings,
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
	const { user, displayName, role, logout, activeMembership } = useAuth();

	const isActive = (prefix: string) => pathname.startsWith(prefix);

	// Extract graphId from /graphs/:id/... routes
	const graphIdMatch = pathname.match(/^\/graphs\/([^/]+)/);
	const currentGraphId = graphIdMatch ? graphIdMatch[1] : null;
	const isGraphDetailPage = !!currentGraphId && currentGraphId !== "new";

	const initial = (user?.first_name ?? "?")[0]?.toUpperCase();

	return (
		<AppLayoutV2
			leftNav={{
				top: (
					<div className="flex items-center justify-center w-full py-3">
						<div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm select-none">
							I
						</div>
					</div>
				),
				topNavItems: [
					{
						name: "Graphs",
						icon: Database,
						tooltipSide: "right",
						className: isActive("/graphs")
							? "bg-accent text-accent-foreground"
							: "",
						onClick: () => navigate("/graphs"),
					},
					{
						name: "Explorer",
						icon: Network,
						tooltipSide: "right",
						showSeperator: true,
					},
					{
						name: "Modeller",
						icon: GitGraph,
						tooltipSide: "right",
						onClick: isGraphDetailPage
							? () => navigate(`/graphs/${currentGraphId}/modeller`)
							: () => navigate("/graphs"),
					},
				],
				bottomNavItems: [
					{
						name: "Settings",
						icon: Settings,
						tooltipSide: "right",
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
							{activeMembership?.workspace_name ??
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
									<div className="w-5 h-5 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
										{initial}
									</div>
									<span className="text-sm">{displayName}</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuLabel>
									<div className="flex flex-col">
										<span>{displayName}</span>
										<span className="text-xs text-muted-foreground font-normal">
											{user?.email}
										</span>
										{role && (
											<span className="text-xs text-muted-foreground font-normal mt-1">
												Role: {role}
											</span>
										)}
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => navigate("/settings/profile")}>
									<UserCircle className="w-4 h-4 mr-2" />
									Profile settings
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => navigate("/settings/members")}>
									<Users className="w-4 h-4 mr-2" />
									Workspace members
								</DropdownMenuItem>
								<RoleGate require="admin">
									<DropdownMenuItem
										onClick={() => navigate("/settings/invitations")}
									>
										<Mail className="w-4 h-4 mr-2" />
										Invitations
									</DropdownMenuItem>
								</RoleGate>
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
