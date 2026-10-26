import { useSearchParams } from "react-router-dom";
import { useModelLinkQuery } from "../queries";
import { stitchPair } from "./allModels";

/**
 * The open stitch's crumb — `Country ≡ country` — on the global model with
 * `?stitch=<id>`; undefined anywhere else. It shares the inspector's read, so
 * it adds no request.
 */
export function useStitchCrumb(
	username: string | undefined,
	graphSlug: string | undefined,
	onGlobalModel: boolean,
): string | undefined {
	const [params] = useSearchParams();
	const stitchId = onGlobalModel ? params.get("stitch") : null;
	const link = useModelLinkQuery(username, graphSlug, stitchId);
	return stitchId && link.data ? stitchPair(link.data, false) : undefined;
}
