# Published runner permission policy and authenticated runtime (CYPACK-1573)

**Date:** 2026-10-11
**Result:** PASS — registry artifact, authenticated tools, final response, cleanup.

## Provenance

- Cyrus [PR #1538](https://github.com/cyrusagents/cyrus/pull/1538) release source:
  `e6db6c17339f71f175e93f79ec65773596aea298`.
- Hosted [PR #1186](https://github.com/cyrusagents/cyrus-hosted/pull/1186):
  `ea39a3c9e4e405bc03f04bcdbfc2189c6725af91`, pinned to core test.11.
- Agent SDK `0.3.296`, bundled Claude Code `2.1.296`; Node `22.17.1`.
- Runner `0.2.74-test.4` was freshly built and published under `test`.
  Its dependency on core resolves exactly to `0.2.74-test.11`.
- Both registry tarballs were downloaded into a fresh consumer, installed,
  and independently hashed against npm's `dist.integrity`.
- Both `latest` tags remain `0.2.73`.

| Package | SHA512 integrity |
| --- | --- |
| `cyrus-claude-runner@0.2.74-test.4` | `sha512-J4M4ErQ8AsB+wk+FCR5N9IMIqCSVEcVW0twQWHngeszWBm7UF9jmoFq4zJga6CcadDbKij4t6GAlRzvuCAQS2A==` |
| `cyrus-core@0.2.74-test.11` | `sha512-N4ufk4Y2enCBDhrEyxS6z0rT9pXb9amo9t2SfF2DG3coaoPg92OVwWaHv5EsvDUigjAJmwJznkoF9MeJpPLlaQ==` |

All 36 installed runner `dist` files match the fresh source build byte for byte.
Installed `dist/ClaudeRunner.js` SHA256:
`b417ab7cd033477f392974d9e17c207528174f1f19f6d43eec4b64db397a23a3`.
Core does not bundle or depend on ClaudeRunner; its existing test.11 release
remains the correct Hosted pin.

## Artifact regression

The new `prepack` lifecycle rebuilds the runner before packing/publishing.
The verifier imports the installed package entry point and intercepts its SDK
query call, asserting explicit default mode, settings sources, tool rules,
and the approval callback across six provider/telemetry configurations:

```sh
node --experimental-test-module-mocks scripts/verify-runner-package.mjs \
  /private/tmp/cyrus-1538-registry/consumer/node_modules/cyrus-claude-runner
```

- Old registry test.3: FAIL, actual permission mode `undefined`.
- Freshly packed candidate test.4: PASS, all six configurations.
- Downloaded registry test.4: PASS, all six configurations.

These mocked checks validate packaging only. The live evidence below is separate.
An attempted CI workflow addition could not be pushed because the GitHub token
lacks `workflow` scope, so the verifier is currently an explicit release check.

## Authenticated installed-package turn

Used the existing Claude Max test identity, with its existing credential file
copied into a private writable temporary Claude configuration directory. No new
identity, API-key fallback, or bypass-permissions mode was used.

Installed-package SDK session: `f5aa6952-cf23-4266-b1b4-af1ccc63a37f`.
The assertions required successful matching tool results, a successful SDK result
containing exactly the marker, and a stopped runner:

1. Read `/private/tmp/cyrus-1538-fixture/package.json` — success.
2. Bash `{ command: "pwd", timeout: 10000, run_in_background: false }` — success.
3. SDK result: `subtype: success`, `is_error: false`,
   `terminal_reason: completed`, `result: SDK_RUNTIME_OK`.
4. `runner.stop()` completed; `runner.isRunning()` was false.

## F1 test drive

Fixture: `/private/tmp/cyrus-1538-fixture`.
F1 used the pushed Cyrus source with its EdgeWorker and SimpleAgentRunner
dependency links directed to the registry-installed runner. EdgeWorker and F1
used the registry-installed core. Source files were not patched for the drive.
The fixture committed `permissions.defaultMode: acceptEdits` in local settings;
the server ran with `DISABLE_TELEMETRY=1`.

- [x] Server healthy and ready on port 3600.
- [x] Issue `issue-1` / `DEF-1` created and routed to the primary repository.
- [x] Session `session-1` created its worktree.
- [x] SDK session `1f99a0aa-d8ff-4ff0-b83b-23cce8a38b83` initialized in `default` mode.
- [x] Read the worktree's `package.json`, with a successful tool result.
- [x] Foreground Bash `pwd`, timeout `10000`, with a successful tool result.
- [x] SDK result was `success`, `is_error: false`, `terminal_reason: completed`,
  and `result: SDK_RUNTIME_OK`.
- [x] Seven timestamped activities included both tool actions and the final
  `response` activity `SDK_RUNTIME_OK`.
- [x] Pagination and marker search returned the expected activities.
- [x] `stop-session` succeeded and SIGINT stopped the server cleanly.

## Checks

- Build and typecheck passed.
- Package tests: 1,916 passed, 2 skipped; runner: 129 passed.
- CLI tests: 162 passed.
- Lint passed with 14 existing warnings; audit found no known vulnerabilities.
- The existing Cyrus allowance catalog has 30 entries. Re-running extraction with
  the authenticated identity reported 189 tools including its connected MCP tools;
  this environment-dependent list is not evidence of a fixed 30-tool SDK surface.
- Cyrus Node 22/24 CI passed on the release source commit.

The final pushed documentation head and final CI reruns are recorded in both
PR descriptions. Runtime acceptance is based on completed authenticated turns,
not the historical CYPACK-1572 OAuth failure or SDK initialization alone.
