import { describe, expect, it } from "vitest";
import { withoutCyrusSecrets } from "../../src/security/agent-env.js";

describe("withoutCyrusSecrets", () => {
	it("drops Cyrus's own credentials and keeps what sessions need", () => {
		const env = {
			PATH: "/usr/bin",
			ANTHROPIC_API_KEY: "model-key",
			GITHUB_TOKEN: "git-token",
			SLACK_BOT_TOKEN: "xoxb-bot",
			LINEAR_CLIENT_SECRET: "client-secret",
			CYRUS_API_KEY: "api-key",
		};

		expect(withoutCyrusSecrets(env)).toEqual({
			PATH: "/usr/bin",
			ANTHROPIC_API_KEY: "model-key",
			GITHUB_TOKEN: "git-token",
		});
	});

	it("does not modify the source environment", () => {
		const env = { SLACK_SIGNING_SECRET: "signing" };

		withoutCyrusSecrets(env);

		expect(env).toEqual({ SLACK_SIGNING_SECRET: "signing" });
	});
});
