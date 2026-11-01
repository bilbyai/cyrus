import { describe, expect, it } from "vitest";
import {
	isSensitiveName,
	SecretRedactor,
} from "../../src/security/SecretRedactor.js";

// Fake credentials are assembled at runtime so secret scanners, such as GitHub
// push protection, don't mistake these fixtures for real tokens.
const fake = (prefix: string, body: string) => `${prefix}${body}`;
const BODY = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
const SLACK_TOKEN = fake(
	"xoxb-",
	"1234567890-0987654321-AbCdEfGhIjKlMnOpQrStUvWx",
);
const LINEAR_SECRET = "8f3a9c1e5b7d2f4a6c8e0b1d3f5a7c9e";

function redactorWithEnv(env: Record<string, string | undefined>) {
	return new SecretRedactor({ env: () => env });
}

describe("SecretRedactor", () => {
	describe("values of secret-named environment variables", () => {
		it("redacts them anywhere in the text and names the variable", () => {
			const redactor = redactorWithEnv({
				LINEAR_CLIENT_SECRET: LINEAR_SECRET,
				PATH: "/usr/bin:/bin",
			});

			expect(redactor.redact(`env dump:\nfoo=${LINEAR_SECRET}\nbar`)).toBe(
				"env dump:\nfoo=[REDACTED:LINEAR_CLIENT_SECRET]\nbar",
			);
		});

		it("reads the environment at redaction time, so reloaded values are covered", () => {
			const env: Record<string, string | undefined> = {};
			const redactor = redactorWithEnv(env);
			env.CUSTOM_API_TOKEN = "late-loaded-token-value-123";

			expect(redactor.redact("value late-loaded-token-value-123")).toBe(
				"value [REDACTED:CUSTOM_API_TOKEN]",
			);
		});

		it("ignores non-secret names, short values, booleans and paths", () => {
			const redactor = redactorWithEnv({
				HOME: "/Users/someone",
				ANTHROPIC_BASE_URL: "http://gateway.internal:8317",
				SHORT_TOKEN: "abc",
				FEATURE_TOKEN_ENABLED: "true",
				GH_TOKEN_PATH: "/Users/someone/.config/gh/token",
			});
			const text =
				"/Users/someone http://gateway.internal:8317 abc true /Users/someone/.config/gh/token";

			expect(redactor.redact(text)).toBe(text);
		});

		it("redacts values of *_KEY variables and of MCP servers' MCP_* variables", () => {
			const redactor = redactorWithEnv({
				LICENSE_KEY: "lk-1234567890abcdef",
				MCP_NOTION_PAT: "ntn-abcdefgh12345678",
			});

			expect(
				redactor.redact("lk-1234567890abcdef and ntn-abcdefgh12345678"),
			).toBe("[REDACTED:LICENSE_KEY] and [REDACTED:MCP_NOTION_PAT]");
		});

		it("leaves other KEY names and MCP settings alone", () => {
			const redactor = redactorWithEnv({
				KEYBOARD_LAYOUT: "us-international-x",
				GIT_CONFIG_KEY_0: "credential.helper",
				MCP_CONNECTION_NONBLOCKING: "true",
			});
			const text =
				'us-international-x credential.helper true "key": "WEB-1383-x"';

			expect(redactor.redact(text)).toBe(text);
		});

		it("prefers the longest match when one secret contains another", () => {
			const redactor = redactorWithEnv({
				OUTER_SECRET: "prefix-inner-secret-value-suffix",
				INNER_SECRET: "inner-secret-value",
			});

			expect(redactor.redact("x prefix-inner-secret-value-suffix y")).toBe(
				"x [REDACTED:OUTER_SECRET] y",
			);
		});

		it("covers explicitly registered secrets", () => {
			const redactor = redactorWithEnv({});
			redactor.registerSecret("linear workspace token", "workspace-token-0001");

			expect(redactor.redact("token workspace-token-0001 used")).toBe(
				"token [REDACTED:linear workspace token] used",
			);
		});
	});

	describe("well-known token formats", () => {
		const redactor = redactorWithEnv({});

		it.each([
			["anthropic", fake("sk-ant-", `api03-${BODY}`)],
			["openai", fake("sk-proj-", BODY)],
			["github", fake("ghp_", BODY)],
			["github", fake("github_pat_", `11ABCDEFG0123456789_${BODY}`)],
			["gitlab", fake("glpat-", "AbCdEfGhIjKlMnOpQrSt")],
			["slack", SLACK_TOKEN],
			["linear", fake("lin_oauth_", BODY)],
			["linear", fake("lin_api_", BODY)],
			["aws", fake("AKIA", "IOSFODNN7EXAMPLE")],
			["google", fake("AIza", "SyAbCdEfGhIjKlMnOpQrStUvWxYz0123456")],
			["stripe", fake("sk_live_", "AbCdEfGhIjKlMnOpQrStUv")],
			[
				"jwt",
				"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
			],
		])("redacts a %s token embedded in text", (label, token) => {
			expect(redactor.redact(`found ${token} in output`)).toBe(
				`found [REDACTED:${label}] in output`,
			);
		});

		it("redacts a Slack incoming webhook URL", () => {
			expect(
				redactor.redact(
					`curl ${fake("https://hooks.slack.com/services/", "T000/B000/XXXXXXXXXXXXXXXX")} -d x`,
				),
			).toBe("curl [REDACTED:slack-webhook] -d x");
		});

		it("redacts a whole private key block", () => {
			const pem = [
				fake("-----BEGIN RSA ", "PRIVATE KEY-----"),
				"MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MaHLbPGO",
				fake("-----END RSA ", "PRIVATE KEY-----"),
			].join("\n");

			expect(redactor.redact(`key:\n${pem}\ndone`)).toBe(
				"key:\n[REDACTED:private-key]\ndone",
			);
		});

		it("redacts a private key cut off by truncated output", () => {
			expect(
				redactor.redact(
					fake(
						"-----BEGIN OPENSSH ",
						"PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAE",
					),
				),
			).toBe("[REDACTED:private-key]");
		});

		it("keeps the scheme of an Authorization header", () => {
			expect(
				redactor.redact(
					'curl -H "Authorization: Bearer abc123DEF456ghi789JKL0" https://api.example.com',
				),
			).toBe(
				'curl -H "Authorization: Bearer [REDACTED]" https://api.example.com',
			);
		});
	});

	describe("credentials in URLs", () => {
		it("redacts the password and keeps user and host", () => {
			const redactor = redactorWithEnv({});

			expect(
				redactor.redact(
					"DATABASE_URL=postgresql://app_user:s3cr3t-P4ss@db.example.com:5432/app",
				),
			).toBe(
				"DATABASE_URL=postgresql://app_user:[REDACTED]@db.example.com:5432/app",
			);
		});
	});

	describe("secret-named assignments", () => {
		const redactor = redactorWithEnv({});

		it.each([
			["STRIPE_SECRET_KEY=a1b2c3d4e5f6g7h8i9", "STRIPE_SECRET_KEY=[REDACTED]"],
			[
				'export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCY"',
				'export AWS_SECRET_ACCESS_KEY="[REDACTED]"',
			],
			['{"apiKey": "pk-9f8e7d6c5b4a"}', '{"apiKey": "[REDACTED]"}'],
			["client_secret: hunter2hunter2", "client_secret: [REDACTED]"],
		])("redacts %s", (input, expected) => {
			expect(redactor.redact(input)).toBe(expected);
		});

		it.each([
			"const token = process.env.SLACK_BOT_TOKEN;",
			"SLACK_BOT_TOKEN=$SLACK_BOT_TOKEN",
			"API_KEY=<your-api-key>",
			"apiKey: string;",
			"password: changeme",
			"const token = getToken();",
		])("leaves code and placeholders alone: %s", (input) => {
			expect(redactor.redact(input)).toBe(input);
		});
	});

	it("leaves ordinary output alone", () => {
		const redactor = redactorWithEnv({ SLACK_BOT_TOKEN: SLACK_TOKEN });
		const text = [
			"commit 898566dc5e2b0c6e1f0a9a8d7c6b5a4f3e2d1c0b",
			"session 07af3664-84f2-4c89-98df-1108aeea2298",
			"M  packages/core/src/security/SecretRedactor.ts",
			"the tokenizer splits tokens; see docs/secrets.md",
		].join("\n");

		expect(redactor.redact(text)).toBe(text);
	});

	it("is idempotent", () => {
		const redactor = redactorWithEnv({ SLACK_BOT_TOKEN: SLACK_TOKEN });
		const once = redactor.redact(
			`token ${SLACK_TOKEN} and STRIPE_SECRET_KEY=a1b2c3d4e5f6g7h8i9`,
		);

		expect(redactor.redact(once)).toBe(once);
	});

	describe("redactDeep", () => {
		it("redacts strings at any depth and leaves the input untouched", () => {
			const redactor = redactorWithEnv({ SLACK_BOT_TOKEN: SLACK_TOKEN });
			const activity = {
				type: "action",
				action: "Bash",
				parameter: "env",
				result: `SLACK_BOT_TOKEN=${SLACK_TOKEN}`,
				meta: { lines: 1, tags: [`t ${SLACK_TOKEN}`], ok: true },
			};

			const redacted = redactor.redactDeep(activity);

			expect(redacted).toEqual({
				type: "action",
				action: "Bash",
				parameter: "env",
				result: "SLACK_BOT_TOKEN=[REDACTED:SLACK_BOT_TOKEN]",
				meta: { lines: 1, tags: ["t [REDACTED:SLACK_BOT_TOKEN]"], ok: true },
			});
			expect(activity.result).toBe(`SLACK_BOT_TOKEN=${SLACK_TOKEN}`);
		});
	});
});

describe("isSensitiveName", () => {
	it.each([
		"SLACK_BOT_TOKEN",
		"LINEAR_WEBHOOK_SECRET",
		"apiKey",
		"client_secret",
		"DB_PASSWORD",
		"GITHUB_APP_PRIVATE_KEY",
		"SENTRY_DSN",
	])("treats %s as sensitive", (name) => {
		expect(isSensitiveName(name)).toBe(true);
	});

	it.each([
		"PATH",
		"HOME",
		"GIT_AUTHOR_NAME",
		"ANTHROPIC_BASE_URL",
		"KEYBOARD",
	])("treats %s as not sensitive", (name) => {
		expect(isSensitiveName(name)).toBe(false);
	});
});
