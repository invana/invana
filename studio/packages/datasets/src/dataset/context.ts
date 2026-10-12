import { useAuth } from "@invana-studio/core";
import { useOutletContext, useParams } from "react-router-dom";
import type { DatasetRef } from "../api";
import type { Dataset } from "../types";

/** The dataset a `/datasets/catalogue/:publisher/:name/…` route is about. */
export function useDatasetRef(): DatasetRef {
	const { publisher = "", name = "" } = useParams();
	return { publisher, name };
}

/**
 * Whether the signed-in person may write this dataset — mint a version, share
 * it, attach a standard: its creator, or an install Admin.
 */
export function useCanWrite(dataset: Dataset | undefined): boolean {
	const { user, isSuperuser } = useAuth();
	if (!dataset || !user) return false;
	return isSuperuser || dataset.created_by_id === user.id;
}

export interface DatasetOutlet {
	dataset: Dataset;
	ref: DatasetRef;
	canWrite: boolean;
}

/** What the dataset page hands each of its tabs. */
export function useDatasetOutlet(): DatasetOutlet {
	return useOutletContext<DatasetOutlet>();
}

/** `/datasets/catalogue/<publisher>/<name>[/<rest>]` */
export function datasetPath(d: DatasetRef, rest = ""): string {
	const base = `/datasets/catalogue/${encodeURIComponent(d.publisher)}/${encodeURIComponent(d.name)}`;
	return rest ? `${base}/${rest}` : base;
}
