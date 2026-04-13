import { AppLayoutV2 } from "@invana/themes";
import { Separator } from "@invana/ui";
import { Database, GitGraph, Network, Settings } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./components/ThemeToggle";

export default function App() {
	const navigate = useNavigate();
	const { pathname } = useLocation();

	const isActive = (prefix: string) => pathname.startsWith(prefix);

	// Extract graphId from /graphs/:id/... routes
	const graphIdMatch = pathname.match(/^\/graphs\/([^/]+)/);
	const currentGraphId = graphIdMatch ? graphIdMatch[1] : null;
	const isGraphDetailPage = !!currentGraphId && currentGraphId !== "new";

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
							{isActive("/graphs") ? "Graphs" : ""}
						</span>
					</div>
				),
				right: (
					<div className="flex items-center gap-1 px-2">
						<ThemeToggle />
					</div>
				),
			}}
			mainSection={{
				content: <Outlet />,
			}}
		/>
	);
}
