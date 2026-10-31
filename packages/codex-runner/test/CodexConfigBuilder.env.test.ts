import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodexConfigBuilder } from "../src/config/CodexConfigBuilder.js";

describe("CodexConfigBuilder env", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("keeps Cyrus's own credentials out of the app-server env", async () => {
		vi.stubEnv("CODEX_HOME", mkdtempSync(join(tmpdir(), "codex-home-")));
		vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-cyrus-bot");
		vi.stubEnv("GITHUB_WEBHOOK_SECRET", "github-webhook-secret");
		vi.stubEnv("OPENAI_API_KEY", "model-key");

		const resolved = await new CodexConfigBuilder({
			workingDirectory: "/ws/repo",
		}).build();

		expect(resolved.env?.SLACK_BOT_TOKEN).toBeUndefined();
		expect(resolved.env?.GITHUB_WEBHOOK_SECRET).toBeUndefined();
		expect(resolved.env?.OPENAI_API_KEY).toBe("model-key");
	});
});
