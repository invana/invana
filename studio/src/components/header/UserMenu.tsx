import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@invana/ui";
import { LogOut, Mail, UserCircle, UserCog, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { RoleGate } from "../RoleGate";

/**
 * Avatar + name dropdown shown on the right side of every AppLayoutV2 header.
 * Encapsulates: profile shortcuts, graph-scoped members/invitations links,
 * superuser admin link, sign out. Used by App.tsx (shell layout) and by the
 * standalone graph pages (Overview / Explorer / Modeller) via `useAppHeader`.
 */
export function UserMenu() {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const { user, displayName, logout, membershipForGraph } = useAuth();

	if (!user) return null;

	const initial = (user.first_name ?? "?")[0]?.toUpperCase();
	const graphMatch = pathname.match(/^\/u\/([^/]+)\/([^/]+)/);
	const urlMembership = membershipForGraph(graphMatch?.[1], graphMatch?.[2]);
	const fallbackMembership = user.graphs?.[0] ?? null;
	const activeMembership = urlMembership ?? fallbackMembership;
	const activeRole = activeMembership?.role ?? null;

	return (
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
							{user.email}
						</span>
						{user.username && (
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
								`/u/${activeMembership.owner_username}/${activeMembership.graph_slug}?settings=members`,
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
								`/u/${activeMembership.owner_username}/${activeMembership.graph_slug}?settings=members`,
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
	);
}
