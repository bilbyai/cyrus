# CYPACK-1601: published SDK runtime verification

**Date:** 2026-10-26

**Goal:** Exercise the published runner/core test packages with Claude Agent SDK 0.3.310 and Anthropic API SDK 1.3.0, without changing the intended first-party account or permission policy.

**Runtime source head:** `0391493d9350a89f7d34046247b51c4ee39dc146`

**Fixture:** `/private/tmp/cypack-1601-consumer.RvsNhB`

## Immutable package identity

A fresh npm consumer installed exactly:

- `cyrus-claude-runner@0.2.75-test.6`, integrity `sha512-gam27P0jSOLTLIuvfe4ITSiv9NCrKPuii9TRvlleU/1j8dAubDB5tJ52BC9r5b5UACgPFqqoFHVNIXnFMilJnw==`
- `cyrus-core@0.2.75-test.6`, integrity `sha512-bOGLdcXvfsyjazkSG/GnCHp8UdkDFVRzK1i8tYWRVlfUhspSLy7xbpA/CYCXtsOiUg/88lrYz+0Gb+qBc7ZXoA==`
- `@anthropic-ai/claude-agent-sdk@0.3.310`, integrity `sha512-fo+sr+9Ks73P001f6XKRQlyzfIBAJMgXArLUkH5Tu98NikRDZeGtFQVj23d5/hj2ijpFgzffrr4fHywY9qUkoQ==`
- `@anthropic-ai/sdk@1.3.0`, integrity `sha512-k7z9BlLLPxfZH+ov7dS6EnaN/wiZeV8YNT1LZfrpAHIy7oY7pHr4UzirF9f2OlHtFEnRBOX+AZQ91Y5fK+TPTw==`

`npm ls` showed one deduplicated copy of each SDK and the runner resolved core `.6`. The clean consumer audit reported zero vulnerabilities. The installed package contract passed in six environment configurations and confirmed `permissionMode: default`, setting sources `user/project/local`, the permission callback, and the requested allow/deny lists. Both package `latest` tags remained `0.2.73`; both `test` tags point to `.6`. Runner `.5` was deprecated because its packed workspace dependency referenced unpublished core `0.2.74`.

## Intended identity and permissions

- Host: Darwin 25.5.0 arm64; OS user `agentops`, UID 502.
- `claude auth status` immediately before the request reported a logged-in first-party Claude.ai Max account for `connor@ceedar.io`.
- No `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or `CLAUDE_CODE_OAUTH_TOKEN` variable name was present in the process environment. No credential was read, changed, refreshed, or substituted.
- The request used model alias `opus`, `maxTurns: 5`, allowed tools `Read` and `Bash(pwd)`, and disallowed tools `Edit`, `Write`, and `NotebookEdit`.
- SDK init resolved `claude-opus-5-5`, session `0128b940-3480-4f91-ad4a-b15f40622d81`, and the expected filtered built-in registry including `Read`, `Bash`, and `TaskStop`, with no `TaskOutput`.

## Reviewed compatibility dispositions

- **Permissions and sandbox:** Cyrus continues to pass explicit `permissionMode: default`, its existing `canUseTool` callback, setting sources, allow/deny lists, and unchanged sandbox configuration. The SDK update does not widen permission or filesystem policy.
- **Tools, results, and tasks:** The generated 30-tool registry still matches Cyrus's configured defaults. `TaskOutput` remains excluded from new defaults while its formatter compatibility stays in place for historical activity. Existing task/tool-result lifecycle and ordering coverage remains authoritative.
- **Monitor and foreground commands:** `Monitor` remains available in the configured registry. Runtime acceptance still requires the bounded foreground `Bash(pwd)` receipt; no background sleep, monitor event, or initialization-only result substitutes for it.
- **MCP elicitation:** Cyrus continues to route `AskUserQuestion` through its existing `canUseTool` elicitation handler. The SDK update does not replace that product flow or loosen strict MCP configuration.
- **API SDK and telemetry:** Cyrus uses its direct Anthropic API SDK dependency only for type imports/re-exports and does not construct an `Anthropic` client, so it does not activate SDK automatic tracing. Hosted's actual API-key clients explicitly disable SDK spans and trace-header propagation, leaving Sentry as the tracing owner.
- **Cursor SDK 1.0.40 merge order:** This PR intentionally does not duplicate CYPACK-1599/#1559's product fix. PR #1561 is merge-blocked until [#1559](https://github.com/cyrusagents/cyrus/pull/1559) at `26c6c9fbfe3ee4627af78883c3ad7acbc3bd8650` (product commit `fcc0a7ac6c26e5d38ab4d7406128c16323572c4b`) lands first and #1561 is reconciled with that main head. That fix opens a SHA-256-keyed `SqliteLocalAgentStore` below `cyrusHome`, reuses it for both `Agent.create` and `Agent.resume`, and disposes it after each run. Its separate live provider gate remains `401 Invalid User API Key`; no provider acceptance is carried forward here.

## Runtime receipts

The bounded prompt requested `Read` of `package.json`, foreground `Bash(pwd)` with timeout `10000`, and exact final text `SDK_RUNTIME_OK`.

The live provider request retried twice and returned `401 OAuth access token has expired` before either tool ran. The terminal SDK result had `subtype: success`, `is_error: true`, and `num_turns: 1`; the runner emitted the corresponding error callback. There was no `Read` receipt, `Bash` receipt, or `SDK_RUNTIME_OK`. `runner.stop()` completed and `runner.isRunning()` was false.

## Conclusion

Package identity, dependency resolution, audit, permission contract, SDK initialization, and clean shutdown passed for the published artifacts. Authenticated end-to-end tool execution remains blocked by the freshly observed expired first-party OAuth token and is not claimed as passed. No authentication, runtime policy, merge, deployment, or stable release was changed to manufacture acceptance.
