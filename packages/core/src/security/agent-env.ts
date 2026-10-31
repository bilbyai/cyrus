/**
 * Environment variables that hold Cyrus's own integration credentials. Cyrus
 * reads them in its own process (webhook verification, MCP server config,
 * tunnels); agent sessions never need them. A session that prints its
 * environment would otherwise expose them.
 */
export const CYRUS_INTERNAL_SECRET_ENV_KEYS: readonly string[] = [
	"LINEAR_CLIENT_SECRET",
	"LINEAR_WEBHOOK_SECRET",
	"SLACK_BOT_TOKEN",
	"SLACK_SIGNING_SECRET",
	"GITHUB_WEBHOOK_SECRET",
	"GITLAB_WEBHOOK_SECRET",
	"ZULIP_API_KEY",
	"ZULIP_WEBHOOK_TOKEN",
	"CYRUS_API_KEY",
	"CLOUDFLARE_TOKEN",
];

/**
 * Copy of `env` without Cyrus's own credentials, for spawning agent processes.
 * Model credentials (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, ...) and git host
 * tokens stay, because sessions need them.
 */
export function withoutCyrusSecrets(
	env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const result = { ...env };
	for (const key of CYRUS_INTERNAL_SECRET_ENV_KEYS) {
		delete result[key];
	}
	return result;
}
