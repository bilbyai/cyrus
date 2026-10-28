# CYPACK-1602: Anthropic SDK 0.3.311 runtime review

**Date:** 2026-10-28

**Goal:** Verify the final published runner/core candidate with Claude Agent SDK `0.3.311` and Anthropic API SDK `1.3.0`, while preserving the intended first-party identity, permission policy, and owned Cursor prerequisite.

**Runtime source reviewed:** `fcf3b3d21084839f658f219e38a36c6e47c0e92d`, reconciled with merged #1563 commit `5207ab452bf5eceb4586b9647a01c704303352fa`

**Clean consumer:** `/tmp/cypack1602-consumer.tzAV0Q`

## Immutable package identity

A fresh npm consumer installed exactly:

- `cyrus-claude-runner@0.2.75-test.8`, integrity `sha512-g3nXndT1NsJRjDOmB2Dv7Gkekik2r+L3QFSqKJCwqTfMxF8yaKO3V0l8/d9ta3niQ+CUO0wKmsIu0stSH5YrVg==`
- `cyrus-core@0.2.75-test.8`, integrity `sha512-LtSB4DcW+gfS7erHTlk7heXuMBGusn8UG+iStkq4MHY1aFP2iP8f7y8LlTiSNzBox31YCy9qVhrqpUvPPuVXRQ==`
- `@anthropic-ai/claude-agent-sdk@0.3.311`, integrity `sha512-8aKYcHGB3LsYP79e2EHNdwbpIvRJkMLd19qSx4u9+J9yDDAK7w9uy1GyvFUz8xa1A+xIEtTW1k/r419uE/Kbsw==`
- `@anthropic-ai/sdk@1.3.0`, integrity `sha512-k7z9BlLLPxfZH+ov7dS6EnaN/wiZeV8YNT1LZfrpAHIy7oY7pHr4UzirF9f2OlHtFEnRBOX+AZQ91Y5fK+TPTw==`

`npm ls` showed the runner resolving core `.8`, Claude Agent SDK `.311`, and API SDK `1.3.0`, with one deduplicated copy of each. Both Cyrus package `latest` tags remain `0.2.73`; both `test` tags point to `.8`. The `.8` runner manifest pins core `.8`, and a fresh consumer audit reported zero vulnerabilities. The earlier `.7` tarballs remain immutable evidence for the pre-#1563 source line but are not used as evidence for this combined graph.

## Intended identity and bounded-request preflight

- Host: Darwin 25.5.0 arm64; Node `v22.17.1`; OS user `agentops`, UID 502.
- System Claude executable: `/Users/agentops/.local/bin/claude`, Claude Code `2.1.280`. The installed Agent SDK `0.3.311` embeds Claude Code `2.1.311`.
- Immediately before the request, `claude auth status --json` reported `loggedIn: true`, `authMethod: claude.ai`, `apiProvider: firstParty`, Max subscription, account `connor@ceedar.io`, organization ID `685559cd-fcf8-43cb-8a0e-eb20cd18cead`, and organization name `connor@ceedar.io's Organization`.
- No `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or `CLAUDE_CODE_OAUTH_TOKEN` variable name was present in the request process environment. No credential was read, changed, refreshed, or substituted.
- The recovered `cyrus-pro` process was already online under `agentops` after the separately authorized restart, and the public status had independently returned HTTP 200 idle. It was not restarted or reconfigured by this review.
- Repository session history contained no newer successful Claude provider transcript for this identity after the prior `.7` attempt. No existing success was treated as evidence for `.8`.
- The request used model alias `opus`, `maxTurns: 5`, allowed `Read` and `Bash(pwd)`, and disallowed `Edit`, `Write`, and `NotebookEdit`.

## Final-package runtime receipt

Exactly one new runner invocation was made against the clean consumer's published `.8` packages. A 120-second outer watchdog bounded the attempt. The prompt required all of the following:

1. use real `Read` on the consumer's `package.json`;
2. run foreground `Bash` command `pwd` with timeout `10000`;
3. reply with exactly `SDK_RUNTIME_OK`.

The request ended after 5.8 seconds with:

```text
Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.
```

The provider rejected the request before either tool ran. The receipt established OS user `agentops`, UID 502, Darwin arm64, Node `22.17.1`, runner/core `.8`, Agent SDK `.311`, API SDK `1.3.0`, session `33dff4cb-41c8-443f-8125-3263bc334af2`, and resolved model `claude-opus-5-5`. The SDK emitted two `api_retry` events, then a terminal result with `subtype: success`, `is_error: true`, and `num_turns: 1`; Cyrus surfaced the error callback. There is no `Read` receipt, foreground `Bash(pwd)` receipt, `SDK_RUNTIME_OK`, or non-error terminal result. `runner.stop()` completed without error, the watchdog did not fire, and `runner.isRunning()` was false.

The `.8` recorder completed and emitted its full provenance/result envelope. Registry integrity was independently established with `npm view`; the provider request was not repeated after the failed acceptance result.

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

## Cursor reconciliation and retained security graph

Merged [CYPACK-1603](https://linear.app/ceedar/issue/CYPACK-1603) / [cyrus#1563](https://github.com/cyrusagents/cyrus/pull/1563) was reconciled into #1564 before `.8` publication. The existing CYPACK-1603 owner retained responsibility for its Cursor provider acceptance; this work did not repeat their request, change their credential, or take ownership.

Completed order:

1. #1563 merged first as `5207ab452bf5eceb4586b9647a01c704303352fa`.
2. #1564 reconciled onto that main as `fcf3b3d21084839f658f219e38a36c6e47c0e92d` without downgrading `@cursor/sdk` `1.1.0` or overwriting the owned store/security fix.
3. The combined graph preserves scalar `cwd`; the `cyrusHome`/`sha256(workspace)` `SqliteLocalAgentStore` supplied to both `Agent.create` and `Agent.resume`; `finally` disposal; and the associated assertions. All 45 Cursor tests pass.
4. The immutable `.8` pair was published and Hosted #1253 was repinned to core `.8` with its exact integrity.
5. The final-package runtime request was attempted once against the intended identity and failed 401 before tools.

#1564 and Hosted #1253 remain held only on the failed real-tool acceptance and ordinary review. Hosted's telemetry policy and exact SQL safeguards remain unchanged; no manual SQL or provider configuration change was made. Reconciliation also removed the newly disclosed unfixed `deepmerge` transitive and advanced `qs` to `6.17.0`; both repository audits report zero advisories.

## Conclusion

Package identity, integrity, dependency resolution, combined Cursor security behavior, permission contracts, upstream compatibility review, CI, and clean stopping are established for `.8`. Authenticated Agent SDK `.311` tool execution is not established: the sole final-package request failed 401 before tools. No authentication, runtime policy, deployment configuration, manual SQL, runtime restart, or stable release was changed to manufacture acceptance.
