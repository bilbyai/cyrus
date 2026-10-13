# CYPACK-1576 replacement-package runtime acceptance

**Date:** 2026-10-13
**Result:** BLOCKED — fresh HTTP 401, OAuth token revoked; no authenticated tool turn.

Keep [Cyrus #1540](https://github.com/cyrusagents/cyrus/pull/1540) and
[Hosted #1187](https://github.com/cyrusagents/cyrus-hosted/pull/1187) unmerged.
This report does not satisfy the runtime acceptance gate.

## Provenance

Initial runs used these pushed heads:

- Cyrus: `b82570fb80df22edafcf843a94563879b47f27b6`.
- Hosted: `254daa1650fa1f2f2666360fae6b3bd61383ad6a`.

Only this report and the internal changelog change in the follow-up commit.
A repeated bounded request on that final pushed documentation head is recorded
in the PR verification section, together with both final SHAs and its session ID.

Fresh consumer: `/private/tmp/cypack-1576-runtime/consumer`.
Downloaded registry tarballs were independently SHA512-hashed and compared with
registry `dist.integrity` and the consumer lockfile. Installed versions matched.

| Package | Verified SHA512 integrity |
| --- | --- |
| `cyrus-claude-runner@0.2.74-test.5` | `sha512-oIH4AQv1e8R2oTsGBmRluFdxfJQP8jhaHF4kJf1gQNmDrSerW6l3G26UWzGzjXMt34E5Z/An74m3ShkfDu9fUA==` |
| `cyrus-core@0.2.74-test.12` | `sha512-hZfmuiIjfcJwRMhFdVcOh0kFAjmk0bp3w41v8GyhTaEXC051u3aw3Lvq7RXsfuoqOdhNMPaGDbI4A09Va33ZYg==` |
| `@anthropic-ai/claude-agent-sdk@0.3.296` | `sha512-Y+cZ2BT8X94mQ9GJOVyIqhjC/nWGvwozUVLjdkzX7aSt+zuo5tgk7Hdv9V7tEUQ9fKnEuiL6moYNWDeHqCD4Lw==` |
| `@anthropic-ai/sdk@0.133.0` | `sha512-jlqUN8p8ESTJj+GJnA4KjzbEfF1waEoGzRT8jwytlYGFFgv+/DUQOxlYGvYw10UzhD1kwLqYzxvA3FrTB2YWuQ==` |

The published runner declares its own `cyrus-core: 0.2.73` dependency; that
unmodified nested dependency is separate from the consumer/F1/Hosted test.12
core. Its registry tarball also verified as
`sha512-+vMGC15a10A+IMi+vqREl6xkiPHeDEWGfBpcYrnBBQ7lFGuBxz8FJP1e3GKOJXQkemUTZi3E8LJ2QiAVOKYs3A==`.
No package was republished or registry tag changed.

Installed runner `dist/ClaudeRunner.js` SHA256:
`b417ab7cd033477f392974d9e17c207528174f1f19f6d43eec4b64db397a23a3`.
The installed-package mock verifier passed all six configurations. This verifies
the artifact contract, not authentication or model/tool execution.

## Fresh installed-package request

`claude auth status` reported the existing Claude Max account as logged in,
using `claude.ai` / `firstParty`. No API key, OAuth environment override, alternate
provider, credential copy, or different identity was supplied. The live request
is the authentication check; the local login-status flag is not sufficient.

The harness imported the registry-installed `ClaudeRunner`, used model `sonnet`,
`maxTurns: 4`, tools `Read` and `Bash`, allowed `Read` and `Bash(pwd)`, and denied
`Write`/`Edit`. The wall-clock bound was 90 seconds with a 100-second process
backstop. The requested sequence was:

```text
Use Read to read package.json in the current directory. Then use Bash with
command "pwd", timeout 10000, and run_in_background false. Only after BOTH
tools return successfully, reply exactly SDK_RUNTIME_OK.
```

Fixture: `/private/tmp/cypack-1576-runtime/fixture/package.json`:

```json
{"name":"cypack-1576-runtime-fixture","private":true}
```

At `2026-10-13T16:13:38Z`, SDK session
`4d1893eb-bfbf-496a-b4f3-d39c6d21a765` returned:

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": true,
  "terminal_reason": "api_error",
  "api_error_status": 401,
  "result": "Failed to authenticate: OAuth token revoked. Please log in again or contact your administrator.",
  "num_turns": 1,
  "duration_ms": 2135,
  "duration_api_ms": 0
}
```

Init reported Claude Code `2.1.296`, model `claude-sonnet-5-5`, and
`permissionMode: default`. This initial direct run used Node `26.5.0`.
The misleading `subtype: success` is not completion: `is_error` and
`terminal_reason` explicitly show failure. There were **zero actual tool calls
or tool results**, and no `SDK_RUNTIME_OK`. `runner.stop()` ran in `finally`,
`runner.isRunning()` was false, and the harness exited nonzero. No live
acceptance pass is claimed.

## F1 protocol

Used the pushed source checkout built with Node `22.17.1` and pnpm `10.33.1`.
F1, EdgeWorker, and SimpleAgentRunner dependency links pointed at the fresh
consumer's registry runner/core where those dependencies existed; source files
were unchanged. Started the compiled server with Node on port 3600 and a fresh
F1 fixture `/private/tmp/cypack-1576-runtime/f1-fixture`.

- Server health/status: ready.
- Issue: `issue-1` / `DEF-1`, routed with the `primary` label.
- Session: `session-1`, started `2026-10-13T16:15:07.393Z`.
- Requested the same Read / foreground Bash / completion-marker sequence.
- SDK session: `9961f104-4501-45aa-b2c8-2c1d4fd15f1f`.
- At `16:15:10Z`, the same revoked-OAuth error occurred before tools executed.
- Four timestamped activities: received request, routing, model, authentication
  error. No tool actions or successful final response.
- Pagination (`--limit 1 --offset 1`) returned one of the four activities.
- `stop-session --session-id session-1` succeeded; SIGINT shut the server down
  with exit code 0. Authentication errors in the logs remain failures.

## Supported reconnect and rerun

The existing owner must run `claude auth login --claudeai` in an interactive
terminal and sign in to the **same intended test account**, then check
`claude auth status`. The installed CLI's `claude auth login --help` confirms
this supported command. Do not supply credentials in a PR or substitute another
identity/provider. No reconnect was attempted by this automated review session.

After reconnect, repeat on both final pushed heads and these exact registry
versions. Record actual Read/Bash inputs and matching successful results,
`is_error: false`, `terminal_reason: completed`, exact `SDK_RUNTIME_OK`, and
clean stop. Until that evidence exists, both PRs remain unapproved for merge.

## Other checks and limitations

- `pnpm build`, `pnpm typecheck`, and `pnpm lint` passed (existing lint warnings).
- `pnpm test:packages:run`: 1,916 passed, 2 skipped.
- Installed-package permission verifier: six configurations passed.
- Hosted's previously reported Check is green; preview/Supabase checks are
  skipped. This work does not establish a full environment-backed Hosted app
  build or apply a migration.
- Existing implementation ownership is unchanged; no new owner/receiver created.
