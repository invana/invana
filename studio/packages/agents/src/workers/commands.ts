/**
 * What *Run it* shows: the exact command or manifest that starts a worker on
 * each platform. Pure text from the minted token, the engine URL and the pool.
 */

import type { RunsOn } from "./types";

/** The worker image's tag until the engine names the install's version. */
export const WORKER_IMAGE_TAG = "latest";

export interface RunInputs {
	engineUrl: string;
	token: string;
	pool: string;
}

/** One container per worker. */
export function dockerCommand({ engineUrl, token, pool }: RunInputs): string {
	return [
		"docker run -d --name invana-worker",
		`-e INVANA_ENGINE_URL=${engineUrl}`,
		`-e INVANA_JOIN_TOKEN=${token}`,
		`-e INVANA_POOL=${pool}`,
		`invana/worker:${WORKER_IMAGE_TAG}`,
	].join(" ");
}

/** `pip install`, then `invana worker`. */
export function pythonCommand({ engineUrl, token, pool }: RunInputs): string {
	return [
		"pip install 'invana[workers]'",
		`invana worker --engine ${engineUrl} --token ${token} --pool ${pool}`,
	].join("\n");
}

/** A Secret holding the token and a Deployment of `replicas` workers. */
export function kubernetesManifest(
	{ engineUrl, token, pool }: RunInputs,
	replicas = 2,
): string {
	const name = `invana-worker-${pool}`;
	return [
		"apiVersion: v1",
		"kind: Secret",
		"metadata:",
		"  name: invana-join",
		"type: Opaque",
		"stringData:",
		`  token: ${token}`,
		"---",
		"apiVersion: apps/v1",
		"kind: Deployment",
		"metadata:",
		`  name: ${name}`,
		"spec:",
		`  replicas: ${replicas}`,
		"  selector:",
		"    matchLabels:",
		`      app: ${name}`,
		"  template:",
		"    metadata:",
		"      labels:",
		`        app: ${name}`,
		"    spec:",
		"      containers:",
		"        - name: worker",
		`          image: invana/worker:${WORKER_IMAGE_TAG}`,
		"          env:",
		"            - name: INVANA_ENGINE_URL",
		`              value: ${engineUrl}`,
		"            - name: INVANA_POOL",
		`              value: ${pool}`,
		"            - name: INVANA_JOIN_TOKEN",
		"              valueFrom:",
		"                secretKeyRef:",
		"                  name: invana-join",
		"                  key: token",
		"",
	].join("\n");
}

/** The text to show for a platform. */
export function runText(runsOn: RunsOn, inputs: RunInputs): string {
	if (runsOn === "docker") return dockerCommand(inputs);
	if (runsOn === "python") return pythonCommand(inputs);
	return kubernetesManifest(inputs);
}

/** The line under the command, per platform. */
export const RUN_NOTE: Record<RunsOn, string> = {
	docker: "Run it on each machine; each becomes one worker.",
	python: "Run it on each machine; each becomes one worker.",
	kubernetes:
		"The same image as Docker, as a Deployment. You set the replicas; each pod joins with the token and gets its own credential.",
};
