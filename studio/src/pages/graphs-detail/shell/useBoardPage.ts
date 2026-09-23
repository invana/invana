import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * `?page=` — which declared board is open, in the URL
 * ([B12](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * A declared board is reached by its id alone: there is no panel state behind
 * it to put back, which is what `subject_id` buys. That is also what makes it
 * the one page kind the URL can carry whole — `kind:id` live, `kind:id@version`
 * frozen, one parser and one key.
 *
 * **A report is the reason this key exists.** A reading kept and then
 * unreachable after a reload is not kept at all: B6's own criterion is
 * *reopening it an hour later*, and an hour is longer than a tab lives.
 *
 * Only the **focused** page is carried. Restoring a whole tab strip from a link
 * would make a shared URL reopen somebody else's session; the page a link names
 * is the one it names.
 */
const PAGE_PARAM = "page";

export function useBoardPage() {
	const [params, setParams] = useSearchParams();
	const pageId = params.get(PAGE_PARAM);

	// The functional form, so the writer is stable across renders — it is handed
	// to the page host, and an unstable one re-fires every effect that has it.
	const setPageId = useCallback(
		(id: string | null) => {
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					if (id) next.set(PAGE_PARAM, id);
					else next.delete(PAGE_PARAM);
					return next;
				},
				{ replace: true },
			);
		},
		[setParams],
	);

	return useMemo(() => ({ pageId, setPageId }), [pageId, setPageId]);
}
