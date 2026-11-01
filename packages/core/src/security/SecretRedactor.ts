/**
 * Redacts secrets from text before Cyrus sends it to Linear, Slack, GitHub,
 * GitLab or Zulip.
 *
 * Agent tool output is posted to those platforms verbatim, so anything a session
 * reads (`env`, `.env` files, keys, tokens) would otherwise be published to
 * everyone with access to the issue, channel or pull request.
 *
 * Three layers run in order:
 * 1. Values of secret-named environment variables (read at redaction time, so
 *    `.env` reloads are covered) and explicitly registered secrets.
 * 2. Well-known token formats, private key blocks, credentials in URLs and
 *    `Authorization` headers.
 * 3. Values assigned to secret-named keys (`.env`, shell, JSON and YAML).
 */

type EnvSource = () => Record<string, string | undefined>;

export interface SecretRedactorOptions {
	/** Environment to collect secret values from. Defaults to `process.env`. */
	env?: EnvSource;
}

/**
 * Lowercased substrings that mark a variable or key name as secret. "auth" and
 * "key" are deliberately absent: they match `GIT_AUTHOR_NAME`, `KEYBOARD` and
 * similar names whose values must stay readable.
 */
const SENSITIVE_NAME_PARTS = [
	"secret",
	"token",
	"password",
	"passwd",
	"passphrase",
	"apikey",
	"api_key",
	"api-key",
	"accesskey",
	"access_key",
	"privatekey",
	"private_key",
	"signingkey",
	"signing_key",
	"encryptionkey",
	"encryption_key",
	"credential",
	"dsn",
	"cookie",
];

const MIN_SECRET_LENGTH = 8;
const REDACTED = "[REDACTED]";

const TOKEN_PATTERNS: ReadonlyArray<readonly [label: string, pattern: RegExp]> =
	[
		[
			"private-key",
			/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g,
		],
		["anthropic", /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
		["openai", /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g],
		[
			"github",
			/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/g,
		],
		["gitlab", /\bglpat-[A-Za-z0-9_-]{20,}/g],
		[
			"slack-webhook",
			/https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g,
		],
		["slack", /\bxox[abeposr]-[A-Za-z0-9-]{10,}/g],
		["linear", /\blin_(?:api|oauth|wh)_[A-Za-z0-9]{20,}/g],
		["aws", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
		["google", /\bAIza[0-9A-Za-z_-]{35}/g],
		["stripe", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g],
		["jwt", /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g],
	];

/** `scheme://user:password@host` keeps the user and host. */
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/?#@]+:)([^\s@/?#]+)@/gi;

/** `Authorization: Bearer <token>` keeps the scheme. */
const AUTH_HEADER = /\b(Bearer|Basic)(\s+)[A-Za-z0-9._~+/-]{16,}=*/g;

/**
 * `NAME=value`, `NAME: value`, `"name": "value"` and `export NAME="value"`.
 * Groups: 1 key quote, 2 name, 3 separator, 4 double-quoted value,
 * 5 single-quoted value, 6 unquoted value.
 */
const ASSIGNMENT =
	/(["']?)\b([A-Za-z_][A-Za-z0-9_.-]*)\1(\s*[:=]\s*)(?:"([^"\n]*)"|'([^'\n]*)'|([^\s"'`,;&)}\]]+))/g;

/** True when a variable or key name looks like it holds a secret. */
export function isSensitiveName(name: string): boolean {
	const lower = name.toLowerCase();
	return SENSITIVE_NAME_PARTS.some((part) => lower.includes(part));
}

/**
 * True when an environment variable's value should be treated as a secret.
 * Wider than {@link isSensitiveName}: `*_KEY` variables hold API keys, and
 * MCP servers get their secrets through `MCP_*` variables. Too broad for
 * assignments in output, where `"key": "..."` is ordinary JSON.
 */
function isSecretEnvName(name: string): boolean {
	return isSensitiveName(name) || /_KEY$/i.test(name) || /^MCP_/i.test(name);
}

function isRedactableValue(value: string): boolean {
	if (value.length < MIN_SECRET_LENGTH) return false;
	if (/^(true|false|null|undefined)$/i.test(value)) return false;
	if (/^\d+$/.test(value)) return false;
	// Paths and variable references are not secrets themselves.
	if (/^[~/.$]/.test(value)) return false;
	return true;
}

function isPlaceholder(value: string): boolean {
	return /^(\$|<|\{\{|%|\[)/.test(value);
}

function redactAssignmentValue(
	quoted: boolean,
	value: string,
): string | undefined {
	if (isPlaceholder(value)) return undefined;
	if (quoted) {
		return value.length >= MIN_SECRET_LENGTH ? REDACTED : undefined;
	}
	// Unquoted values are usually code (`getToken`, `process.env.X`, `string`)
	// unless they look generated: long, with a digit and no member access.
	if (value.length < 12 || !/\d/.test(value) || value.includes(".")) {
		return undefined;
	}
	return REDACTED;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object") return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/**
 * Removes secrets from outbound text. Use {@link secretRedactor} or
 * {@link redactSecrets} unless a test needs its own environment.
 */
export class SecretRedactor {
	private readonly env: EnvSource;
	private readonly registered = new Map<string, string>();

	constructor(options: SecretRedactorOptions = {}) {
		this.env = options.env ?? (() => process.env);
	}

	/**
	 * Redact a secret that doesn't live in the environment, such as an OAuth
	 * token read from config. The name appears in the redaction marker.
	 */
	registerSecret(name: string, value: string | undefined): void {
		if (value && isRedactableValue(value)) {
			this.registered.set(value, name);
		}
	}

	redact(text: string): string {
		if (!text) return text;

		let result = text;
		for (const [value, name] of this.knownSecrets()) {
			if (result.includes(value)) {
				result = result.split(value).join(`[REDACTED:${name}]`);
			}
		}
		for (const [label, pattern] of TOKEN_PATTERNS) {
			result = result.replace(pattern, `[REDACTED:${label}]`);
		}
		result = result.replace(URL_CREDENTIALS, `$1${REDACTED}@`);
		result = result.replace(AUTH_HEADER, `$1$2${REDACTED}`);
		return result.replace(
			ASSIGNMENT,
			(match, keyQuote, name, separator, doubleQuoted, singleQuoted, bare) => {
				if (!isSensitiveName(name)) return match;
				const quote =
					doubleQuoted !== undefined
						? '"'
						: singleQuoted !== undefined
							? "'"
							: "";
				const value = doubleQuoted ?? singleQuoted ?? bare;
				const replacement = redactAssignmentValue(quote !== "", value);
				if (replacement === undefined) return match;
				return `${keyQuote}${name}${keyQuote}${separator}${quote}${replacement}${quote}`;
			},
		);
	}

	/** Redact every string in a plain object or array. Returns a copy. */
	redactDeep<T>(value: T): T {
		if (typeof value === "string") {
			return this.redact(value) as T;
		}
		if (Array.isArray(value)) {
			return value.map((item) => this.redactDeep(item)) as T;
		}
		if (isPlainObject(value)) {
			return Object.fromEntries(
				Object.entries(value).map(([key, item]) => [
					key,
					this.redactDeep(item),
				]),
			) as T;
		}
		return value;
	}

	/** Secret values and their names, longest first so containing secrets win. */
	private knownSecrets(): Array<[value: string, name: string]> {
		const secrets = new Map(this.registered);
		for (const [name, value] of Object.entries(this.env())) {
			if (value && isSecretEnvName(name) && isRedactableValue(value)) {
				if (!secrets.has(value)) secrets.set(value, name);
			}
		}
		return [...secrets].sort(([a], [b]) => b.length - a.length);
	}
}

/** Process-wide redactor reading `process.env`. */
export const secretRedactor = new SecretRedactor();

/** Redact secrets from text about to leave Cyrus. */
export function redactSecrets(text: string): string {
	return secretRedactor.redact(text);
}

/** Redact secrets from every string in a payload about to leave Cyrus. */
export function redactSecretsDeep<T>(value: T): T {
	return secretRedactor.redactDeep(value);
}
