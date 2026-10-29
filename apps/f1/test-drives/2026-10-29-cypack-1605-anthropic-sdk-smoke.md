# CYPACK-1605: Anthropic SDK 0.3.312 runtime review

**Date:** 2026-10-29

**Goal:** Supersede CYPACK-1602 with the latest Claude Agent SDK `0.3.312` and Anthropic API SDK `1.3.0`, while retaining its reviewed permission, package, Hosted migration, Cursor prerequisite, and authenticated-runtime gates.

**Base source:** merged CYPACK-1603 / cyrus#1563 commit `5207ab452bf5eceb4586b9647a01c704303352fa`, plus the reviewed CYPACK-1602 source changes advanced from Agent SDK `0.3.311` to `0.3.312`.

**Clean consumer:** `/private/tmp/cypack1605-consumer.hxPevo`

## Immutable package identity

A fresh npm consumer installed exactly:

- `cyrus-claude-runner@0.2.75-test.9`, integrity `sha512-/ez61FinFKlhkhUBlP0TnJNjBYA/vwG2xfCF/CrGwTshpZ9mUpZQAQWC+F9tWSXxntye8mCYsJRL7UTA+Ys9fA==`
- `cyrus-core@0.2.75-test.9`, integrity `sha512-Pj2xX4QrTpekazL5AzxiDxZw2A8D7KKTeyHmEipc/YqcOGMUclFoT8fQCVNUVOGDb2N9WwaV0dexq+ulbM0lzw==`
- `@anthropic-ai/claude-agent-sdk@0.3.312`
- `@anthropic-ai/sdk@1.3.0`

`npm ls` showed one deduplicated Agent SDK and API SDK. The published runner pins core `.9`; the core manifest pins Agent SDK `.312`. Both Cyrus packages' `test` tags point to `.9`, both `latest` tags remain `0.2.73`, and the clean consumer audit reported zero vulnerabilities. The installed package-contract verifier passed all six first-party/third-party-provider and telemetry configurations with explicit `permissionMode: "default"`.

## Tool registry refresh

`./scripts/extract-claude-tools.sh` ran against the native Claude Code `2.1.312` binary bundled with Agent SDK `0.3.312`. Its init block contained the same 30 built-in tools represented by `packages/claude-runner/src/config.ts`; no built-in addition or removal was required. The init block also listed nine environment-provided `mcp__agent-waymark__*` tools. Those are MCP tools, not built-ins, and correctly remain outside the static Claude allowance registry.

The published core defaults already omit retired `TaskOutput`. Hosted still pins a pre-refresh core and can store the previous verbatim defaults, so its companion change pins core `.9` and migrates only exact previous Linear, Slack, and GitHub defaults. Customized, reordered, empty, `NULL`, and historical lists remain unchanged.

## Intended identity and bounded-request preflight

- Host: Darwin arm64; Node `v22.17.1`; OS user `agentops`, UID 502.
- Immediately before the mandatory extraction and final-package attempt, `claude auth status --json` reported `loggedIn: true`, `authMethod: claude.ai`, `apiProvider: firstParty`, Max subscription, account `connor@ceedar.io`, and organization `connor@ceedar.io's Organization`.
- No `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or `CLAUDE_CODE_OAUTH_TOKEN` variable name was present in the final-package request environment. No credential, authentication setting, provider configuration, or running Cyrus process was read, changed, refreshed, or substituted.
- The final request used model alias `opus`, `maxTurns: 5`, allowed `Read` and `Bash(pwd)`, disallowed `Edit`, `Write`, and `NotebookEdit`, and used a 120-second outer watchdog.

## Final-package runtime receipt

Exactly one runner invocation was made against the clean consumer's published `.9` packages. The prompt required all of the following:

1. use real `Read` on the consumer's `package.json`;
2. run foreground `Bash` command `pwd` with timeout `10000`;
3. reply with exactly `SDK_RUNTIME_OK`.

The request ended after about six seconds with:

```text
Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.
```

The provider rejected the request before either tool ran. The receipt established runner/core `.9`, Agent SDK `.312`, API SDK `1.3.0`, session `53de777c-6bba-4a05-a482-503be9cd4dca`, Darwin arm64, Node `22.17.1`, and OS user `agentops` UID 502. The SDK emitted a terminal result with `subtype: success`, `is_error: true`, and `num_turns: 1`; Cyrus surfaced the error callback. There is no `Read` receipt, foreground `Bash(pwd)` receipt, `SDK_RUNTIME_OK`, or non-error terminal result. `runner.stop()` completed, the watchdog did not fire, and `runner.isRunning()` was false. The request was not repeated.

The earlier `.8`/Agent SDK `.311` and `.7` receipts remain predecessor evidence only. Mocked query tests, package-contract checks, initialization, tool-list init blocks, and clean stopping do not substitute for authenticated tool execution.

## Full upstream range reviewed

The review carries forward the official Agent SDK, Claude Code, and Anthropic API SDK histories reviewed for CYPACK-1602 and extends them through Agent SDK `0.3.312` / Claude Code `2.1.312`:

- Cyrus Agent SDK: `0.3.281` through `0.3.312`; Hosted's prior core baseline: `0.3.268` through `0.3.312`.
- Embedded Claude Code: the corresponding range through `2.1.312`.
- Cyrus API SDK: `0.128.0` through `1.3.0`; Hosted API SDK: `0.125.0` through `1.3.0`.

## Compatibility dispositions through 0.3.312

- **Node floor and startup:** Agent SDK `.311` raises its minimum Node version to `18.14`; Cyrus requires Node 22. Deferred background startup work now begins on first request and may take roughly ten seconds. Constructor/init completion is not provider acceptance.
- **Permissions, auto mode, and sandbox:** Cyrus passes explicit `permissionMode: "default"`, `canUseTool`, setting sources, allow/deny lists, and sandbox configuration. Agent SDK `.312` adds typed `autoMode`, `skipAutoPermissionPrompt`, `useAutoModeDuringPlan`, and `permissions.disableAutoMode` settings and aligns invalid managed/user/project values with CLI parsing. These additive settings do not opt Cyrus into auto mode or replace its explicit policy.
- **AskUserQuestion:** `.312` adds capability-gated `unanswered` annotations (`skipped`, `replied_in_chat`, or `dismissed`) to per-question answers. Cyrus's existing `canUseTool` handler still returns answered/denied outcomes; no widening or synthetic unanswered state is introduced.
- **Tools, results, and tasks:** The generated 30-tool built-in registry still matches Cyrus's configured defaults. `TaskOutput` remains excluded from new defaults while formatter compatibility remains for historical activity.
- **Monitor and foreground commands:** `Monitor` remains configured. Runtime acceptance still requires the distinct foreground `Bash(pwd)` timeout-`10000` receipt; a background event or timeout is not equivalent.
- **Retry, startup timeout, and compaction:** The reviewed range includes unattended retry watchdog events, startup timeout handling, `autoCompactWindow`, and server-declared non-retryable/compaction fixes. A provider 401 remains a failed gate rather than being hidden by retries or a success-shaped SDK envelope.
- **Cache-lifetime fields:** `.311` adds optional five-minute and one-hour cache-creation usage fields. They are additive telemetry/type surface and do not establish runtime success.
- **MCP provenance and managed mounts:** Cyrus must authorize from SDK-provided provenance, never a spoofable server name. `mcpMount` is managed mount provenance, not equivalent to trusted `sdk` provenance.
- **Managed plugin trust:** Trust depends on managed `pluginDigests` matching plugin directory contents; a name or path alone is not trusted.
- **Signed model catalog:** Claude Code `2.1.311+` loads a signed catalog from `downloads.claude.ai` by default for Bedrock, Mantle, Vertex, and Foundry; `CLAUDE_CODE_MODEL_CATALOG=off` opts out. Cyrus does not silently alter that provider policy.
- **API SDK and telemetry:** API SDK `0.134.0` can enable OpenTelemetry with a global tracer and `1.0.0` changes the default API version to `2026-10-21`. Cyrus only imports/re-exports API SDK types. Hosted explicitly disables SDK spans and trace-header propagation so Sentry remains its tracing owner.

## Cursor reconciliation and retained security graph

Merged CYPACK-1603 / cyrus#1563 remains the base. The replacement retains `@cursor/sdk` `1.1.0`, scalar `cwd`, the `cyrusHome`/SHA-256 workspace `SqliteLocalAgentStore` supplied to create and resume, final disposal, assertions, and the zero-advisory graph. This work does not repeat or take ownership of Cursor provider acceptance.

## Conclusion

Package identity, integrity, dependency resolution, tool-registry parity, combined Cursor security behavior, permission contracts, upstream compatibility review, and clean stopping are established for `.9`. Authenticated Agent SDK `.312` tool execution is not established: the sole final-package request failed 401 before tools. No authentication, runtime policy, deployment configuration, manual SQL, runtime restart, or stable release was changed to manufacture acceptance.
