import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@invana/ui";
import { Activity, LogOut, UserCircle, UserCog } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

/**
 * Avatar + name dropdown pinned to the very bottom of the left rail
 * (NavVertical's `bottom` slot) on every AppLayoutV2 surface. Encapsulates:
 * profile shortcuts, superuser admin link, sign out. Used by App.tsx (shell
 * layout) and by the standalone graph pages (Explorer / Modeller) via the
 * `useGraphLeftNav` rail. The menu pops out to the right of the rail.
 */
export function UserMenu() {
	const navigate = useNavigate();
	const { user, displayName, logout } = useAuth();

	if (!user) return null;

	const initial = (user.first_name ?? "?")[0]?.toUpperCase();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="flex items-center h-7 px-0 my-1.5"
				>
					<div className="w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center">
						{initial}
					</div>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="right" align="end" className="w-56">
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
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => navigate("/settings/profile")}>
					<UserCircle className="w-4 h-4 mr-2" />
					Profile settings
				</DropdownMenuItem>
				{user.is_superuser && (
					<>
						<DropdownMenuItem onClick={() => navigate("/platform/events")}>
							<Activity className="w-4 h-4 mr-2" />
							Platform events
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => {
								window.location.href = "/admin";
							}}
						>
							<UserCog className="w-4 h-4 mr-2" />
							Platform admin
						</DropdownMenuItem>
					</>
				)}
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
