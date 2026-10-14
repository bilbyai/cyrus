# Test Drive: Claude Agent SDK 0.3.299 Runtime

**Date**: 2026-10-14
**Goal**: Verify the updated Claude runner can start an F1 issue session with the refreshed tool registry, preserve explicit manual permission mode, execute Read and Bash, emit the requested response, and stop cleanly.
**Cyrus commit**: `c872e149`
**Hosted commit**: `04d7b68c`
**Test repository**: `/private/tmp/f1-cypack-1578.J5CsXS/test-repo`

## Expected behavior

1. Route `[repo=f1-test-repo]` to the configured F1 repository.
2. Create a worktree and start a Claude session using SDK 0.3.299.
3. Expose the refreshed 30-tool registry with `permissionMode: "default"`.
4. Read `package.json`, run `pwd`, and return exactly `SDK_RUNTIME_OK` only after both tools succeed.
5. Render coherent activities, support paginated inspection, stop the session, and shut down gracefully.

## Verification results

### Passed before the authentication boundary

- F1 server started on port 3600 and reported `ready`.
- Test issue `DEF-4` was created and routed by `[repo=f1-test-repo]`.
- A worktree was created from local `main`.
- Session `session-4` started and received Claude session ID `16792f6b-7295-428b-a94c-06c6659d31f5`.
- The `claude_query_options` event reported:
  - `permissionMode: "default"`
  - 30 SDK tools plus four scoped repository reads
  - `canUseTool`, hooks, plugins, and the configured MCP server
- Activity pagination returned four coherent activities: acknowledgment, routing, model selection, and the authentication error.
- `stop-session` succeeded and the F1 server shut down gracefully.

### Blocked

- Claude returned `Failed to authenticate: OAuth token revoked. Please log in again or contact your administrator.`
- Authentication failed before the model could issue Read or Bash, so there were no tool inputs/results and no `SDK_RUNTIME_OK` response.
- The changed runtime path is therefore not end-to-end accepted despite the passing unit, package, and harness checks.

## Commands

```bash
./apps/f1/f1 init-test-repo --path /private/tmp/f1-cypack-1578.J5CsXS/test-repo
CYRUS_PORT=3600 CYRUS_REPO_PATH=/private/tmp/f1-cypack-1578.J5CsXS/test-repo bun run apps/f1/server.ts
CYRUS_PORT=3600 ./apps/f1/f1 ping
CYRUS_PORT=3600 ./apps/f1/f1 status
CYRUS_PORT=3600 ./apps/f1/f1 create-issue \
  --title "Validate Claude Agent SDK 0.3.299 runtime" \
  --description $'Read package.json, run pwd, then reply with exactly SDK_RUNTIME_OK only after both tools succeed. Do not edit files.\n\n[repo=f1-test-repo]'
CYRUS_PORT=3600 ./apps/f1/f1 start-session --issue-id issue-4
CYRUS_PORT=3600 ./apps/f1/f1 view-session --session-id session-4 --limit 10 --offset 0
CYRUS_PORT=3600 ./apps/f1/f1 stop-session --session-id session-4
```

## Final retrospective

The F1 harness proved routing, worktree creation, option assembly, activity rendering, pagination, session stop, and server cleanup on SDK 0.3.299. It could not prove authenticated model/tool execution because the existing Claude account token is revoked server-side.

The existing owner should reconnect the intended account interactively with `claude auth login --claudeai`, verify it with `claude auth status`, and rerun this bounded scenario. Acceptance requires actual Read and Bash inputs/results, `SDK_RUNTIME_OK`, no error result, and clean stop.
