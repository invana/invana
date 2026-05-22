import { AppLayoutV2 } from "@invana/themes";
import { GitGraph, Network, UserCircle } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAppHeader } from "./components/header/useAppHeader";

export default function App() {
	const navigate = useNavigate();
	const { pathname } = useLocation();

	// Explorer/Modeller live under /u/:username/:graphSlug/... and only make
	// sense while a Graph is being viewed — show those nav items only when the
	// URL is graph-scoped. On non-graph routes (/graphs list, /settings/*),
	// the left rail is empty at the top.
	const graphMatch = pathname.match(/^\/u\/([^/]+)\/([^/]+)/);
	const graphScopedPath = graphMatch
		? `/u/${graphMatch[1]}/${graphMatch[2]}`
		: null;

	const topNavItems = graphScopedPath
		? [
				{
					name: "Explorer",
					icon: Network,
					tooltipSide: "right" as const,
					onClick: () => navigate(`${graphScopedPath}/explorer`),
				},
				{
					name: "Modeller",
					icon: GitGraph,
					tooltipSide: "right" as const,
					onClick: () => navigate(`${graphScopedPath}/modeller`),
				},
			]
		: [];

	const header = useAppHeader();

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
			header={header}
			mainSection={{
				content: <Outlet />,
			}}
		/>
	);
}
