/**
 * What *Run it* shows: the exact command that starts a worker on each
 * platform, and the Deployment manifest Kubernetes applies. Pure text from the
 * minted token, the engine URL and the pool.
 */

import type { RunsOn } from "./types";

export interface RunInputs {
	engineUrl: string;
	/** The engine's image for its own version, `invana/worker:<version>`. */
	image: string;
	token: string;
	pool: string;
	labels: string[];
	slots: number;
	/** Kubernetes only: the replicas to scale to. */
	replicas?: number;
}

/** Lines joined with shell continuations, every line after the first indented. */
const continued = (lines: string[]): string =>
	lines.map((l, i) => (i === 0 ? l : `  ${l}`)).join(" \\\n");

/** One container per worker. */
export function dockerCommand(i: RunInputs): string {
	return continued([
		"docker run -d --restart unless-stopped --name invana-worker",
		`-e INVANA_ENGINE_URL=${i.engineUrl}`,
		`-e INVANA_JOIN_TOKEN=${i.token}`,
		`-e INVANA_POOL=${i.pool}`,
		`-e INVANA_LABELS=${i.labels.join(",")}`,
		`-e INVANA_SLOTS=${i.slots}`,
		i.image,
	]);
}

/** `pip install`, then `invana worker`, then how to keep it running. */
export function pythonCommand(i: RunInputs): string {
	return [
		"pip install 'invana[workers]'",
		"",
		continued([
			"invana worker",
			`--engine ${i.engineUrl}`,
			`--token ${i.token}`,
			`--pool ${i.pool} --labels ${i.labels.join(",")} --slots ${i.slots}`,
		]),
		"",
		"# keep it running: invana worker install-service  (systemd · launchd)",
	].join("\n");
}

const deploymentName = (pool: string) => `invana-worker-${pool}`;
const manifestFile = (pool: string) => `${deploymentName(pool)}.yaml`;

/** The token as a Secret, the Deployment applied from its file, then the replicas. */
export function kubernetesCommands(i: RunInputs): string {
	return [
		`kubectl create secret generic invana-join --from-literal=token=${i.token}`,
		`kubectl apply -f ${manifestFile(i.pool)}   # a Deployment of invana/worker — Download as a file`,
		`kubectl scale deployment ${deploymentName(i.pool)} --replicas=${i.replicas ?? 2}`,
	].join("\n");
}

/** The Deployment `kubectl apply` reads; the token comes from the `invana-join` Secret. */
function kubernetesManifest(i: RunInputs): string {
	const name = deploymentName(i.pool);
	return [
		"apiVersion: apps/v1",
		"kind: Deployment",
		"metadata:",
		`  name: ${name}`,
		"spec:",
		`  replicas: ${i.replicas ?? 2}`,
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
		`          image: ${i.image}`,
		"          env:",
		"            - name: INVANA_ENGINE_URL",
		`              value: ${i.engineUrl}`,
		"            - name: INVANA_POOL",
		`              value: ${i.pool}`,
		"            - name: INVANA_LABELS",
		`              value: ${i.labels.join(",")}`,
		"            - name: INVANA_SLOTS",
		`              value: "${i.slots}"`,
		"            - name: INVANA_JOIN_TOKEN",
		"              valueFrom:",
		"                secretKeyRef:",
		"                  name: invana-join",
		"                  key: token",
		"",
	].join("\n");
}

/** The text shown for a platform. */
export function runText(runsOn: RunsOn, inputs: RunInputs): string {
	if (runsOn === "docker") return dockerCommand(inputs);
	if (runsOn === "python") return pythonCommand(inputs);
	return kubernetesCommands(inputs);
}

/** What *Download as a file* saves: the script, or the manifest for Kubernetes. */
export function downloadOf(
	runsOn: RunsOn,
	inputs: RunInputs,
): { name: string; text: string } {
	if (runsOn === "kubernetes")
		return {
			name: manifestFile(inputs.pool),
			text: kubernetesManifest(inputs),
		};
	return {
		name: `invana-worker-${inputs.pool}.sh`,
		text: runText(runsOn, inputs),
	};
}

/** The line under the command, per platform. */
export const RUN_NOTE: Record<RunsOn, string> = {
	docker:
		"Needs Docker and outbound HTTPS (443) to the engine. One container is one worker.",
	python:
		"Python 3.14 and outbound HTTPS (443) to the engine. The worker logs to stdout.",
	kubernetes:
		"The same image as Docker, as a Deployment. You set the replicas; each pod joins with the token and gets its own credential.",
};
