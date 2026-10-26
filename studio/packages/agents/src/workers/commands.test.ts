import { describe, expect, it } from "vitest";
import {
	dockerCommand,
	kubernetesManifest,
	pythonCommand,
	WORKER_IMAGE_TAG,
} from "./commands";

const inputs = {
	engineUrl: "https://invana.example.com",
	token: "invana_join_abc",
	pool: "egress",
};

describe("run-it commands", () => {
	it("builds the docker run line with the three variables", () => {
		expect(dockerCommand(inputs)).toBe(
			`docker run -d --name invana-worker -e INVANA_ENGINE_URL=https://invana.example.com -e INVANA_JOIN_TOKEN=invana_join_abc -e INVANA_POOL=egress invana/worker:${WORKER_IMAGE_TAG}`,
		);
	});

	it("installs the extra, then joins the pool", () => {
		const [install, run] = pythonCommand(inputs).split("\n");
		expect(install).toBe("pip install 'invana[workers]'");
		expect(run).toBe(
			"invana worker --engine https://invana.example.com --token invana_join_abc --pool egress",
		);
	});

	it("makes a Secret and a Deployment that reads it", () => {
		const yaml = kubernetesManifest(inputs, 4);
		expect(yaml).toContain("kind: Secret");
		expect(yaml).toContain("  token: invana_join_abc");
		expect(yaml).toContain("kind: Deployment");
		expect(yaml).toContain("name: invana-worker-egress");
		expect(yaml).toContain("replicas: 4");
		expect(yaml).toContain("secretKeyRef");
	});
});
