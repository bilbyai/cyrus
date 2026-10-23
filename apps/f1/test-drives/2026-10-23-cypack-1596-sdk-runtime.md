# CYPACK-1596: Claude Agent SDK 0.3.309 runtime acceptance

**Date:** 2026-10-23
**Goal:** Verify the upgraded Claude runner keeps Cyrus's explicit permission boundary and can execute a bounded authenticated Read/Bash turn end to end.
**Tested source:** CYPACK-1596 runtime tree, with `cyrus-claude-runner@0.2.75-test.2` and final-manifest `cyrus-core@0.2.75-test.3` published from the same implementation
**Test repository:** `/private/tmp/f1-cypack-1596.rPEF8V/repo`

## Changed-behavior assertions

- [x] F1 created `DEF-1`, accepted repository selection, and created its isolated worktree.
- [x] The runner initialized Claude Agent SDK 0.3.309 with the refreshed 30-tool registry.
- [x] The emitted `claude_query_options` event reported `cqo.permissionMode=default`, `cqo.hasCanUseTool=true`, and the expected project/user/local setting sources.
- [x] Routing, model, and error activities rendered coherently; the six-activity session view worked with `--limit 10 --offset 0`.
- [x] The stop signal was accepted and the F1 server shut down gracefully.
- [ ] The authenticated turn did not execute Read or Bash and did not return `SDK_RUNTIME_OK`.

## Agent SDK and Claude Code compatibility decisions

The reviewed range is Agent SDK `0.3.281..0.3.309`, including its Claude Code
`2.1.309` runtime. Cyrus applies the following decisions rather than relying on
source compilation alone:

| Upstream behavior | Cyrus decision and coverage |
| --- | --- |
| SDK-supplied MCP servers now win over same-named settings servers. | Adopt. Cyrus merges file configs in configured order and applies inline `mcpConfig` last, then passes one resolved map. `strictMcpConfig` defaults to `true`, so a later user/project settings load cannot replace it; opting out is an explicit operator choice. Existing runner tests cover strict and non-strict modes. |
| HTTP MCP retries are limited to read-only or idempotent tools. | Adopt the SDK-owned transport behavior. Cyrus does not add a second MCP retry loop or relabel write tools, so ambiguous writes are not duplicated by this integration. |
| `allowedMcpServers` no longer filters a managed stdio server whose substitutions occur only in `env`. | No Cyrus-specific allowlist interpretation is added. With the default strict MCP map, ambient managed servers are excluded; an operator who opts into ambient configuration receives the upstream managed-policy behavior, including `deniedMcpServers` as the exclusion mechanism. |
| `claude_code.safety_event` telemetry describes permission, auto-mode, hook and sandbox decisions. | Treat as SDK telemetry only. Cyrus does not translate telemetry into authority. `permissionMode: "default"`, Cyrus tool rules, and `canUseTool` remain the decision boundary; permission-mode tests assert the exact query options. |
| `sandbox.allowNestedUserNamespaces` is an opt-in that weakens Linux file protections. | Do not enable it. Cyrus passes sandbox settings only when explicitly configured, and the subprocess environment scrub remains disabled pending CYPACK-1108. Existing sandbox requirement/config tests cover the current boundary. |
| Fork, transcript, hook, background-task and partial-error behavior changed across the range. | Adopt the fixes without changing Cyrus's public contract. The internal Stop hook records both scheduled and background work before declaring a session idle; dedicated lifecycle tests cover that state. Formatter tests cover background-agent events and successful and error partial result envelopes. |
| SDK 0.3.309 preserves `disableAllHooks`, `disableSkillShellExecution`, and empty managed hook allowlists. | No Cyrus-owned `managedSettings` are supplied, so there is no host policy object for Cyrus to transform or drop. Cyrus's direct SDK `hooks` option remains separate; `ClaudeRunner.test.ts` asserts the Stop hook reaches `query()`, and `pending-work-lifecycle.test.ts` proves a caller Stop hook still runs alongside the pending-work recorder. Adopt the upstream preservation fix. |
| `extractFromBunfs()` now isolates extraction per OS user and replaces a cached CLI whose bytes differ. | Not invoked by Cyrus's Node-distributed runner. The SDK resolves its platform-native optional package directly unless an operator explicitly supplies `pathToClaudeCodeExecutable`; Cyrus neither calls `extractFromBunfs()` nor overrides the default path. The installed-package verifier imports the registry package and exercises the SDK query boundary, while registry integrity checks bind the immutable package bytes. Adopt for any future Bun-compiled consumer without adding a second cache. |
| Claude Code 2.1.309 closes shell-startup, symlinked `denyWrite`, MCP-config write, permission-check and isolation-guard gaps. | Adopt the bundled CLI fixes; Cyrus does not reimplement their sandbox parser. Cyrus forwards the SDK sandbox object and passes one resolved strict MCP server map. `RunnerConfigBuilder.writable-paths.test.ts` asserts the filesystem boundary and fail-closed `allowUnsandboxedCommands: false`; `ClaudeRunner.test.ts` asserts strict MCP configuration and inline-over-file resolution. No settings exclusion or bypass is added. |
| `sed -i` now uses the normal Bash permission path and is not restored by `/rewind`. | Adopt. Cyrus has no contract that Bash mutations are checkpointed, does not expose SDK file rewind, and routes Bash through its normal tool rules / `canUseTool`. Verification and repository cleanliness remain the recovery boundary. |
| Claude-created worktrees no longer lazily fetch missing objects; partial clones prefetch first. | Adopt for SDK subagent worktrees. Cyrus-created issue worktrees are independent: `GitService` explicitly runs `git fetch origin` before `git worktree add`, with existing creation/fallback tests. Cyrus does not enable lazy object fetching or override the SDK's worktree behavior. |
| When the sandbox is enabled but unavailable, excluded commands can no longer silently fall back unsandboxed for writes to the sandbox write list. | Adopt. Cyrus supplies no `excludedCommands` and explicitly forces `allowUnsandboxedCommands: false` whenever its sandbox is enabled. The targeted `RunnerConfigBuilder.writable-paths.test.ts` assertion protects both facts, so the 2.1.309 restriction tightens rather than conflicts with Cyrus's policy. |

Primary change records: [Agent SDK changelog](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md), [Claude Code 2.1.305](https://github.com/anthropics/claude-code/releases/tag/v2.1.305), [Claude Code 2.1.307](https://github.com/anthropics/claude-code/releases/tag/v2.1.307), and [Agent SDK 0.3.309](https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.309).

## Session log

1. Started F1 on port 3600 with the fresh fixture repository; `ping` and `status` passed.
2. Created `DEF-1` with instructions to read `package.json`, run foreground `pwd` with timeout `10000`, and finish with `SDK_RUNTIME_OK`.
3. Started `session-1` and selected the sole configured repository.
4. F1 routed the issue, created `/tmp/cyrus-f1-1792739589156/worktrees/DEF-1`, and logged the 30-tool allowance list.
5. SDK initialization emitted `permissionMode: default` and assigned Claude session `c37709d2-971a-4c25-9db8-54f604d8a351`.
6. The provider rejected the model turn with `Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.`
7. Viewed the paginated session, sent the stop signal, and stopped the server cleanly.

## Runtime identity and reconnect boundary

- OS execution identity: local macOS account `agentops`, UID `502` (the same user that launches the F1 Node/Bun processes and owns the Claude CLI config directory).
- Host: macOS 26.5.2 (25F84), Darwin arm64.
- Runtime: Node.js 22.17.1 and Bun 1.4.2.
- Intended credential runtime: the first-party Claude.ai Max login stored by Claude Code for OS user `agentops`, account `connor@ceedar.io`, organization `connor@ceedar.io's Organization`. Neither the current process nor `~/.cyrus/.env` supplies `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or `CLAUDE_CODE_OAUTH_TOKEN`, so there is no provider or account substitution in the F1 path.
- Supported same-identity reconnect: `claude auth login --claudeai --email connor@ceedar.io`, followed by a real request. This interactive account action was not launched unattended.

## Final retrospective

The SDK/runtime integration, permission policy, routing, worktree lifecycle, activity rendering, pagination, and shutdown paths passed on the replacement 0.3.309 tree. After rebasing onto main's independently merged Fastify fix (#1555), freshly packed candidate archives were byte-for-byte identical to the immutable registry archives for `cyrus-core@0.2.75-test.3` and `cyrus-claude-runner@0.2.75-test.2` (the runner comparison used its original `cyrus-core@0.2.75-test.2` publish dependency set). A new test publish is therefore neither necessary nor possible at those immutable versions; the `test` tags remain on core `.3` and runner `.2`, and stable `latest` remains `0.2.73`. Full runtime acceptance remains blocked by the existing Claude OAuth credential being expired server-side: `claude auth status --json` identifies the account above, but an actual model request rejects it. An authorized operator for that same identity must reconnect it and rerun this bounded scenario before the PR is ready. Required completion evidence is a final-head, published-package fixture whose agent successfully reads `package.json`, runs foreground `pwd` with timeout `10000`, completes with `SDK_RUNTIME_OK`, emits no error result, and stops cleanly.
