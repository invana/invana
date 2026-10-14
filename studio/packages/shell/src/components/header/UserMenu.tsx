import { useTheme } from "@invana/themes";
import {
	Button,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@invana/ui";
import { useAuth } from "@invana-studio/core";
import {
	Activity,
	GraduationCap,
	LogOut,
	Palette,
	UserCircle,
	UserCog,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOpenGraph } from "../../products";
import { useOnboarding } from "../../setup/useOnboarding";
import { useToolsAlwaysShown } from "../../toolsPreference";

const MODES = [
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
	{ value: "system", label: "System" },
] as const;

/**
 * Avatar dropdown at the end of `header.right` on every shell surface: who is
 * signed in, the person's own switches — *Tools always shown* and the theme —
 * the open Graph's set-up, their profile, the superuser's admin links and
 * sign out. The header holds none of these as buttons of its own.
 */
export function UserMenu() {
	const navigate = useNavigate();
	const { user, displayName, logout } = useAuth();
	const graph = useOpenGraph();
	const { open: openSetup } = useOnboarding();
	const { mode, setMode } = useTheme();
	const [toolsShown, setToolsShown] = useToolsAlwaysShown();

	if (!user) return null;

	const initial = (user.first_name ?? user.username ?? "?")[0]?.toUpperCase();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="ml-1 rounded-full"
					aria-label="User menu"
				>
					<span className="flex size-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
						{initial}
					</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="bottom" align="end" className="w-60">
				<DropdownMenuLabel>
					<div className="flex flex-col">
						<span>{displayName}</span>
						<span className="font-normal text-muted-foreground">
							{user.email}
						</span>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuCheckboxItem
					checked={toolsShown}
					onCheckedChange={(on) => setToolsShown(on === true)}
				>
					Tools always shown
				</DropdownMenuCheckboxItem>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Palette className="mr-2 size-4" />
						Theme
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuRadioGroup
							value={mode}
							onValueChange={(m) =>
								setMode(m as (typeof MODES)[number]["value"])
							}
						>
							{MODES.map((m) => (
								<DropdownMenuRadioItem key={m.value} value={m.value}>
									{m.label}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				{graph && (
					<DropdownMenuItem onClick={openSetup}>
						<GraduationCap className="mr-2 size-4" />
						Graph setup
					</DropdownMenuItem>
				)}
				<DropdownMenuItem onClick={() => navigate("/settings/profile")}>
					<UserCircle className="mr-2 size-4" />
					Profile
				</DropdownMenuItem>
				{user.is_superuser && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => navigate("/platform/events")}>
							<Activity className="mr-2 size-4" />
							Platform events
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => {
								window.location.href = "/admin";
							}}
						>
							<UserCog className="mr-2 size-4" />
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
					<LogOut className="mr-2 size-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
