import { describe, expect, it } from "vitest";
import {
	dockerCommand,
	downloadOf,
	kubernetesCommands,
	pythonCommand,
	WORKER_IMAGE_TAG,
} from "./commands";

const inputs = {
	engineUrl: "https://invana.example.com",
	token: "invana_join_abc",
	pool: "egress",
	labels: ["cpu", "egress"],
	slots: 8,
};

describe("run-it commands", () => {
	it("builds the docker run command with the pool's labels and slots", () => {
		const text = dockerCommand(inputs);
		expect(text.split(" \\\n")).toEqual([
			"docker run -d --restart unless-stopped --name invana-worker",
			"  -e INVANA_ENGINE_URL=https://invana.example.com",
			"  -e INVANA_JOIN_TOKEN=invana_join_abc",
			"  -e INVANA_POOL=egress",
			"  -e INVANA_LABELS=cpu,egress",
			"  -e INVANA_SLOTS=8",
			`  invana/worker:${WORKER_IMAGE_TAG}`,
		]);
	});

	it("installs the extra, then joins the pool", () => {
		const text = pythonCommand(inputs);
		expect(text.startsWith("pip install 'invana[workers]'\n")).toBe(true);
		expect(text).toContain("--pool egress --labels cpu,egress --slots 8");
	});

	it("applies a Deployment that reads the token from a Secret", () => {
		const k = { ...inputs, replicas: 4 };
		expect(kubernetesCommands(k)).toContain(
			"kubectl scale deployment invana-worker-egress --replicas=4",
		);
		const file = downloadOf("kubernetes", k);
		expect(file.name).toBe("invana-worker-egress.yaml");
		expect(file.text).toContain("kind: Deployment");
		expect(file.text).toContain("secretKeyRef");
		expect(file.text).not.toContain("invana_join_abc");
	});
});
