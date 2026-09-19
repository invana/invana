import { UserMenu } from "@/components/header/UserMenu";
import { useAppHeader } from "@/components/header/useAppHeader";
import { AppLayoutV2 } from "@invana/themes";
import { Outlet } from "react-router-dom";

export default function App() {
	// `leftNav` has no top items here. This shell hosts the graph-less routes
	// only — the list, profile settings, platform events; every graph-scoped URL
	// is `GraphDetailPage`, which owns its own `AppLayoutV2` and its own
	// `leftNav` (graph-detail-page.md G1). There used to be Explorer and
	// Modeller items behind a `/u/:username/:graphSlug` path test that no route
	// under this shell can satisfy, so they never drew.
	const topNavItems: never[] = [];

	const header = useAppHeader();

	return (
		<AppLayoutV2
			leftNav={{ topNavItems, bottom: <UserMenu /> }}
			header={header}
			mainSection={{
				content: <Outlet />,
			}}
		/>
	);
}
