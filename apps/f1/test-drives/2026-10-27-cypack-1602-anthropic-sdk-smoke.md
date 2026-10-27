# CYPACK-1602: Anthropic SDK 0.3.311 runtime review

**Date:** 2026-10-27

**Goal:** Verify the final published runner/core candidate with Claude Agent SDK `0.3.311` and Anthropic API SDK `1.3.0`, while preserving the intended first-party identity, permission policy, and owned Cursor prerequisite.

**Runtime source reviewed:** `e856ad50054bbcf9d2d47d53737f1aa5ee9c1f60`

**Clean consumer:** `/tmp/cypack1602-consumer.bgN3Y7`

## Immutable package identity

A fresh npm consumer installed exactly:

- `cyrus-claude-runner@0.2.75-test.7`, integrity `sha512-i5v0rvn3CDihxWnO+9nkVX4ncKDEri3Z/RPlct6aunWBaxd9N05y9BF6O4gcahuElA+5AmhIQDSBZdX818eFow==`
- `cyrus-core@0.2.75-test.7`, integrity `sha512-yIHfdK3G+dRgD2GFs4qD+V5Bw3ZLQxHjtDAgVAczckIsVCKzghg0Bj+1NmG6/UDPxlD9GKGkLL3MRZu+L8vHAQ==`
- `@anthropic-ai/claude-agent-sdk@0.3.311`, integrity `sha512-8aKYcHGB3LsYP79e2EHNdwbpIvRJkMLd19qSx4u9+J9yDDAK7w9uy1GyvFUz8xa1A+xIEtTW1k/r419uE/Kbsw==`
- `@anthropic-ai/sdk@1.3.0`, integrity `sha512-k7z9BlLLPxfZH+ov7dS6EnaN/wiZeV8YNT1LZfrpAHIy7oY7pHr4UzirF9f2OlHtFEnRBOX+AZQ91Y5fK+TPTw==`

`npm ls` showed the runner resolving core `.7`, Claude Agent SDK `.311`, and API SDK `1.3.0`. Both Cyrus package `latest` tags remained `0.2.73`; the test publications did not move stable. The `.7` tarballs are immutable evidence for the reviewed source line, but they predate the required reconciliation with Cursor PR #1563. After #1563 lands, the reconciled final head therefore requires a new test candidate and the same acceptance sequence; `.7` cannot stand in for that future combined graph.

## Intended identity and bounded-request preflight

- Host: Darwin 25.5.0 arm64; Node `v22.17.1`; OS user `agentops`, UID 502.
- System Claude executable: `/Users/agentops/.local/bin/claude`, Claude Code `2.1.280`. The installed Agent SDK `0.3.311` embeds Claude Code `2.1.311`.
- Immediately before the request, `claude auth status --json` reported `loggedIn: true`, `authMethod: claude.ai`, `apiProvider: firstParty`, Max subscription, account `connor@ceedar.io`, organization ID `685559cd-fcf8-43cb-8a0e-eb20cd18cead`, and organization name `connor@ceedar.io's Organization`.
- No `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or `CLAUDE_CODE_OAUTH_TOKEN` variable name was present in the request process environment. No credential was read, changed, refreshed, or substituted.
- Repository session history and PM2 activity contained no newer successful Claude provider request for this identity after the prior `.6` attempt. Successful later sessions used Codex, so they are not evidence for Claude acceptance.
- The request used model alias `opus`, `maxTurns: 5`, allowed `Read` and `Bash(pwd)`, and disallowed `Edit`, `Write`, and `NotebookEdit`.

## Final-package runtime receipt

Exactly one new runner invocation was made against the clean consumer's published `.7` packages. A 120-second outer watchdog bounded the attempt. The prompt required all of the following:

1. use real `Read` on the consumer's `package.json`;
2. run foreground `Bash` command `pwd` with timeout `10000`;
3. reply with exactly `SDK_RUNTIME_OK`.

The request ended after 7.5 seconds with:

```text
Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.
```

The provider rejected the request before either tool ran. There is no `Read` receipt, foreground `Bash(pwd)` receipt, `SDK_RUNTIME_OK`, or non-error terminal result. `runner.stop()` ran from `finally` and the process exited; clean stopping is established, but the mandatory runtime acceptance is not.

After stopping, the recorder's attempt to resolve the SDK's `package.json` through Node package exports failed because that subpath is not exported. This post-processing failure did not cause or obscure the earlier provider 401. Installed versions and registry integrity were independently established with `npm ls` and `npm view`; the provider request was not repeated merely to improve the report envelope.

The earlier F1 smoke remains useful only for issue routing, worktree creation, 30-tool registry loading, session assignment, activity rendering, pagination, and shutdown. Its initialization and 401 result do not establish Agent SDK `.311` tool execution. Likewise, the prior `.6`/Agent SDK `.310` attempt, mock query, package-contract test, initialization, and stop receipts do not substitute for this acceptance gate.

## Full upstream range reviewed

The review covered the official [Agent SDK changelog](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md), [Claude Code 2.1.311 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.311), and [Anthropic API SDK changelog](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/CHANGELOG.md), not only the final patch:

- Cyrus Agent SDK: `0.3.281` through `0.3.311`; Hosted's prior core baseline: `0.3.268` through `0.3.311`.
- Embedded Claude Code: the corresponding range through `2.1.311`.
- Cyrus API SDK: `0.128.0` through `1.3.0`; Hosted API SDK: `0.125.0` through `1.3.0`.
- The predecessor `.310` and API `1.3.0` histories were retained and rechecked; `.311` adds rather than replaces their dispositions.

## Compatibility dispositions through 0.3.311

- **Node floor and startup:** Agent SDK `.311` raises its minimum Node version to `18.14`; Cyrus requires Node 22 and this host used `22.17.1`. Deferred background startup work now begins on first request and may take roughly ten seconds. Cyrus must not treat constructor/init completion as provider acceptance; the bounded first request remains authoritative.
- **Permissions and sandbox:** Cyrus continues to pass explicit `permissionMode: default`, its existing `canUseTool` callback, setting sources, allow/deny lists, and unchanged sandbox configuration. Agent SDK `.302` default-mode changes therefore do not supply an implicit policy or widen filesystem access.
- **Tools, results, and tasks:** The generated 30-tool registry still matches Cyrus's configured defaults. `TaskOutput` remains excluded from new defaults while formatter compatibility remains for historical activity. Existing task/tool-result lifecycle, ordering, init, and stop coverage remains useful but does not replace the live acceptance receipt.
- **Monitor and foreground commands:** `Monitor` remains configured. Agent SDK `.285` makes timeout bounds apply to `run_in_background` commands, with its own background limits. Runtime acceptance still requires the distinct foreground `Bash(pwd)` timeout-`10000` receipt; a background event or timeout is not equivalent.
- **Retry, startup timeout, and compaction:** The reviewed range includes unattended retry watchdog events, startup timeout handling, `autoCompactWindow`, and Claude Code `2.1.311` fixes for server-declared non-retryable requests and compaction. Cyrus preserves error propagation and bounded shutdown. A provider 401 must remain a failed gate rather than be hidden by retries, compaction, or a success-shaped SDK envelope.
- **Cache-lifetime fields:** `.311` adds optional `cacheCreationEphemeral5mInputTokens` and `cacheCreationEphemeral1hInputTokens` usage fields. They are additive telemetry/type surface. Their presence alone does not support any claim of live runtime success, token-accounting correctness, data leakage, or absence of regression.
- **MCP provenance and managed mounts:** MCP server provenance now carries a source. Cyrus must authorize from the SDK-provided provenance, never a spoofable server name. Current `.311` types also include `mcpMount` as a permission-rule source; it is managed mount provenance, not equivalent to the trusted `sdk` source and not a reason to bypass existing strict MCP/elicitation policy.
- **Managed plugin trust:** `.311` managed settings include `pluginDigests`. Trust depends on the managed digest matching the plugin directory contents; Cyrus must not infer trust from a plugin name or path. This is an upstream managed-policy hook and does not authorize a new local trust path.
- **MCP elicitation:** Cyrus continues to route `AskUserQuestion` through its existing `canUseTool` elicitation handler. The update does not replace that product flow or loosen strict MCP configuration.
- **Signed model catalog:** Claude Code `2.1.311` loads a signed catalog from `downloads.claude.ai` by default for Bedrock, Mantle, Vertex, and Foundry; `CLAUDE_CODE_MODEL_CATALOG=off` opts out. The observed request was first-party and did not exercise those providers. Cyrus does not silently set the opt-out or alter provider configuration; deployments that use those providers retain an explicit network/policy choice.
- **API SDK and telemetry:** API SDK `0.134.0` can enable OpenTelemetry when a global tracer is present, and `1.0.0` changes the default API version to `2026-10-21`. Cyrus only imports/re-exports API SDK types and does not instantiate an Anthropic client. Hosted's clients explicitly disable SDK spans and trace-header propagation, and its tests preserve explicit Bearer/default-version behavior. Additive API response types do not by themselves establish live correctness or prove the absence of leakage/regression.

## Cursor compatibility prerequisite and merge order

PR #1564 is held behind [CYPACK-1603](https://linear.app/ceedar/issue/CYPACK-1603) / [cyrus#1563](https://github.com/cyrusagents/cyrus/pull/1563). The existing CYPACK-1603 owner retains responsibility for Cursor provider acceptance; this work does not repeat their request, change their credential, or take ownership.

Required order:

1. #1563 establishes its Cursor provider acceptance and is approved.
2. #1563 merges first.
3. #1564 is reconciled onto that merged main without downgrading `@cursor/sdk` `1.1.0` or overwriting the owned store/security fix.
4. The reconciled graph preserves scalar `cwd`; the `cyrusHome`/`sha256(workspace)` `SqliteLocalAgentStore` supplied to both `Agent.create` and `Agent.resume`; `finally` disposal; and the associated assertions.
5. A new immutable Cyrus test candidate is published from that reconciled head, Hosted #1253 is repinned to it, and final-package `Read` + foreground `Bash(pwd)` + `SDK_RUNTIME_OK` acceptance is rerun once the intended identity is supported.

Until then, #1564 and Hosted #1253 remain held. Hosted's telemetry policy and exact SQL safeguards are accepted as written; no manual SQL, provider configuration, or Hosted source change is part of this follow-up.

## Conclusion

Package identity, integrity, dependency resolution, permission contracts, upstream compatibility review, and clean stopping are established for `.7`. Authenticated Agent SDK `.311` tool execution is not established: the sole final-package request failed 401 before tools. No authentication, runtime policy, deployment configuration, manual SQL, merge, or stable release was changed to manufacture acceptance.
