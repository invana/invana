import { useAppVersionQuery } from "../../../hooks/queries/useAppVersion";

/**
 * Engine version chip for page footers. Renders nothing while loading or if
 * the endpoint errors — the footer just stays clean rather than showing a
 * skeleton in a 25px-tall strip.
 */
export function AppVersion() {
	const { data } = useAppVersionQuery();
	if (!data?.version) return null;
	return <span title={data.app_name}>v{data.version}</span>;
}
