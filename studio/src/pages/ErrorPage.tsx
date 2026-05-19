import { Button } from "@invana/ui";
import { Home, RefreshCw } from "lucide-react";
import {
	isRouteErrorResponse,
	useNavigate,
	useRouteError,
} from "react-router-dom";

export function ErrorPage() {
	const error = useRouteError();
	const navigate = useNavigate();

	const is404 = isRouteErrorResponse(error) && error.status === 404;
	const title = is404 ? "404 — Page not found" : "Something went wrong";
	const description = is404
		? "The page you're looking for doesn't exist or has been moved."
		: error instanceof Error
			? error.message
			: "An unexpected error occurred.";

	return (
		<div className="flex flex-col items-center justify-center h-screen gap-6 bg-background text-foreground px-4">
			<div className="flex flex-col items-center gap-3 text-center max-w-md">
				<span className="text-7xl font-black text-muted-foreground/20 select-none leading-none">
					{is404 ? "404" : "500"}
				</span>
				<h1 className="text-2xl font-semibold">{title}</h1>
				<p className="text-muted-foreground">{description}</p>
			</div>
			<div className="flex items-center gap-2">
				<Button variant="outline" size="sm" onClick={() => navigate(-1)}>
					<RefreshCw className="w-3.5 h-3.5 mr-1.5" />
					Go back
				</Button>
				<Button
					size="sm"
					onClick={() => navigate("/graphs", { replace: true })}
				>
					<Home className="w-3.5 h-3.5 mr-1.5" />
					Graphs
				</Button>
			</div>
		</div>
	);
}
