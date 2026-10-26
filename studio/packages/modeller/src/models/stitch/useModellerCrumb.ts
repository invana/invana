import { useSearchParams } from "react-router-dom";
import {
	useModelLinkQuery,
	useModelsQuery,
	useModelVersionsQuery,
} from "../queries";
import { stitchPair } from "./allModels";

/**
 * The app header's last crumb on a Modeller page that opens something the
 * route does not name: the open stitch on the global model (`Country ≡
 * country`), or the model whose canvas is open (`AirRoutes v2 · draft`,
 * `AirRoutes` with no draft). Undefined anywhere else. It shares the pages'
 * reads, so it adds no request.
 */
export function useModellerCrumb(
	username: string | undefined,
	graphSlug: string | undefined,
	pathname: string,
): string | undefined {
	const [params] = useSearchParams();
	const stitchId = pathname.endsWith("/modeller/global-model")
		? params.get("stitch")
		: null;
	const modelId =
		pathname.endsWith("/modeller/models") &&
		params.get("models_view") === "schema"
			? params.get("model")
			: null;

	const link = useModelLinkQuery(username, graphSlug, stitchId);
	const models = useModelsQuery(modelId ? username : undefined, graphSlug);
	const versions = useModelVersionsQuery(
		username,
		graphSlug,
		modelId ?? undefined,
	);

	if (stitchId) return link.data ? stitchPair(link.data, false) : undefined;
	if (!modelId) return undefined;
	const model = models.data?.find((m) => m.id === modelId);
	if (!model) return undefined;
	const draft = versions.data?.find((v) => v.status === "draft");
	if (!draft) return model.name;
	return draft.version
		? `${model.name} v${draft.version} · draft`
		: `${model.name} · draft`;
}
