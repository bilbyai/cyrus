# CYPACK-1600: final published SDK runtime verification

**Date:** 2026-10-25

**Goal:** Exercise the final published runner/core packages with their resolved Agent SDK 0.3.310 and API SDK 1.3.0 identities, without changing the intended first-party account or permission policy.

**Runtime source head:** `e0b59e197e46f2833d68e9e576c9364ea3845187` (the later evidence correction changes this report only)

**Fixture:** `/private/tmp/cypack-1600-final-runtime-20261025` (removed after receipts were captured)

## Corrected evidence boundary

The CYPACK-1598 run ended with HTTP 401 before `Read` or `Bash`. The successful
CYPACK-1596 published-package turn resolved Agent SDK 0.3.309, not 0.3.310.
Neither is accepted as final-package runtime proof for this change. The runner
and core source being unchanged between those reports also does not make the
different SDK and package identities runtime-equivalent.

## Immutable package identity

A clean npm registry fixture installed exactly:

- `cyrus-claude-runner@0.2.75-test.4`, integrity `sha512-UHy8FSfPfXhsV02afcyHRNL030Y6BzdWAfGBjGrU61H0Vn8gcrbzsv+jAlejQubs9rQ+w0HB07V5OyM8aakWcg==`
- `cyrus-core@0.2.75-test.5`, integrity `sha512-s4/hiCBSL6TCT/sUjBB84lWiZXuhi/t2vKodjqtg8drsITL/I4pa4Ui92Km+zNTmDxmC8mi5v/hGGWkbwl+2OA==`
- `@anthropic-ai/claude-agent-sdk@0.3.310`, integrity `sha512-fo+sr+9Ks73P001f6XKRQlyzfIBAJMgXArLUkH5Tu98NikRDZeGtFQVj23d5/hj2ijpFgzffrr4fHywY9qUkoQ==`
- `@anthropic-ai/sdk@1.3.0`, integrity `sha512-k7z9BlLLPxfZH+ov7dS6EnaN/wiZeV8YNT1LZfrpAHIy7oY7pHr4UzirF9f2OlHtFEnRBOX+AZQ91Y5fK+TPTw==`

`npm ls --all` showed one deduplicated copy of each SDK. The runner's published
dependency points to core `.5`, and the core and runner `test` tags point to
`.5` and `.4` respectively while both `latest` tags remain `0.2.73`. The clean
fixture audit reported zero vulnerabilities. Its directory, manifests, and
installed package directories were owned by `agentops` UID 502 with no
group/other write bit.

## Intended identity and permissions

- Host: macOS 26.5.2 (25F84), Darwin arm64; Node.js 22.17.1.
- OS user: `agentops`, UID 502; `/Users/agentops/.claude` has the same owner.
- `claude auth status` immediately before the request reported `loggedIn: true`,
  `authMethod: claude.ai`, `apiProvider: firstParty`, Max subscription, and
  `connor@ceedar.io` in `connor@ceedar.io's Organization`.
- Neither the process nor `/Users/agentops/.cyrus/.env` contained an
  `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or `CLAUDE_CODE_OAUTH_TOKEN`
  variable name. No credential was read, changed, refreshed, or substituted.
- Query options reported `permissionMode: default`, `hasCanUseTool: true`,
  setting sources `user/project/local`, allowed tools `Read` and `Bash(pwd)`,
  disallowed tools `Edit`, `Write`, and `NotebookEdit`, and `maxTurns: 5`.
- The SDK init receipt reported model `claude-opus-5-5`, the expected built-in
  registry including `Read`, `Bash`, and `TaskStop`, and no `TaskOutput`.

## Actual runtime receipts

Session `706e415b-7d5c-4645-8e0d-505d90e43e29` received the bounded prompt to
read `package.json`, run foreground `pwd` with timeout `10000`, and then return
exact `SDK_RUNTIME_OK`.

The live provider request retried twice and returned:

`Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.`

The terminal SDK result had `subtype: success`, `is_error: true`, `num_turns: 1`,
and the same authentication error text. The runner emitted the corresponding
error callback. There were no assistant tool-use blocks, no tool-result blocks,
no `Read` receipt, no foreground `Bash` receipt, and no `SDK_RUNTIME_OK`. After
completion `session.isRunning` was false; `runner.stop()` was invoked and
`runner.isRunning()` remained false. The fixture, runner script, and isolated
npm cache were then removed.

## Affected-path F1 assertions

- **Claude final-package start and policy:** reached SDK init with the exact
  published dependency identities and expected permission inputs.
- **Authenticated Claude tool/result path:** **blocked** by the freshly observed
  expired OAuth token before provider execution; it is not accepted as passed.
- **Core tool defaults/package graph:** clean install/import and targeted tests
  confirm current defaults and package resolution, but do not replace the
  missing authenticated model turn.
- **Cursor SDK 1.0.40 / scalar `local.cwd`:** coordinated with the sole
  CYPACK-1599/#1559 owner and did not duplicate its repair or drive. Its runtime
  product commit `fcc0a7ac6c26e5d38ab4d7406128c16323572c4b` opens and reuses an explicit
  workspace-local SQLite agent store. The coordinated drive reached the
  selected DEF-1 worktree and created `index.db`, resolving the prior
  `~/.cursor` `EPERM` without changing sandbox or authentication policy.
  `Agent.create` then reached `GET /v1/models`, where the unchanged
  `CURSOR_API_KEY` returned `401 Invalid User API Key`; because create returned
  no SDK agent, continuation reopened the same store but could not resume the
  placeholder session. No provider tool/result receipt or marker exists. Stop,
  hook removal, server shutdown, and port cleanup passed. The committed evidence
  at current head `26c6c9fb` is [CYPACK-1599's Cursor runtime report](https://github.com/cyrusagents/cyrus/blob/26c6c9fb/apps/f1/test-drives/2026-10-25-cypack-1599-cursor-sdk-runtime.md).

## Conclusion

Static/package verification passes for the final SDK identities, and both
runners reached their updated initialization boundaries. End-to-end provider
acceptance remains blocked by the concrete current environment failures above.
No historical run is treated as a substitute, and no auth, runtime, or policy
change was made to manufacture a pass.
