import type { LinearClient } from "@linear/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LinearIssueTrackerService } from "../src/LinearIssueTrackerService.js";

// Assembled at runtime so secret scanners don't mistake the fixture for a real token.
const SLACK_TOKEN = [
	"xoxb",
	"1234567890",
	"0987654321",
	"AbCdEfGhIjKlMnOpQrStUvWx",
].join("-");

function serviceWithStubClient() {
	const client = {
		createAgentActivity: vi.fn().mockResolvedValue({ success: true }),
		createComment: vi.fn().mockResolvedValue({
			success: true,
			comment: Promise.resolve({ id: "comment-1" }),
		}),
	};
	const service = new LinearIssueTrackerService(
		client as unknown as LinearClient,
	);
	return { client, service };
}

describe("LinearIssueTrackerService secret redaction", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("redacts tool output in agent activities before they reach Linear", async () => {
		vi.stubEnv("SLACK_BOT_TOKEN", SLACK_TOKEN);
		const { client, service } = serviceWithStubClient();

		await service.createAgentActivity({
			agentSessionId: "session-1",
			content: {
				type: "action",
				action: "Bash",
				parameter: "env",
				result: `SLACK_BOT_TOKEN=${SLACK_TOKEN}\nHOME=/Users/agent`,
			},
		});

		expect(client.createAgentActivity).toHaveBeenCalledWith({
			agentSessionId: "session-1",
			content: {
				type: "action",
				action: "Bash",
				parameter: "env",
				result: "SLACK_BOT_TOKEN=[REDACTED:SLACK_BOT_TOKEN]\nHOME=/Users/agent",
			},
		});
	});

	it("redacts comment bodies but keeps attachment URLs intact", async () => {
		const { client, service } = serviceWithStubClient();

		await service.createComment("issue-1", {
			body: "connect with postgres://app:hunter2hunter2@db.example.com/app",
			attachmentUrls: ["https://uploads.linear.app/a/b/screenshot.png"],
		});

		expect(client.createComment).toHaveBeenCalledWith({
			issueId: "issue-1",
			body: "connect with postgres://app:[REDACTED]@db.example.com/app\n\n![attachment](https://uploads.linear.app/a/b/screenshot.png)",
			parentId: undefined,
		});
	});
});
