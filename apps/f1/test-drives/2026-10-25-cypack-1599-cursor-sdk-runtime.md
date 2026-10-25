# CYPACK-1599 Cursor SDK Runtime Acceptance

**Date**: 2026-10-25  
**Result**: BLOCKED — filesystem state-store compatibility is verified, but provider acceptance remains blocked by the existing invalid Cursor API key
**Goal**: Exercise Cursor selected-worktree start, tool/result activity, continuation, and stop after upgrading `@cursor/sdk` from 1.0.19 to 1.0.40 and changing `local.cwd` from an array to a scalar.  
**Initial tested source commit**: `8c55681b39a75431904785e96f3b03a75daedb3e`
**Writable-store follow-up commit**: `fcc0a7ac6c26e5d38ab4d7406128c16323572c4b`
**Installed SDK**: `@cursor/sdk` 1.0.40  
**Cursor CLI**: `2026.04.28-e984b46`  
**Test repository**: `/private/tmp/cypack-1599-cursor-f1-20261025-0900`  
**F1 home**: `/tmp/cyrus-f1-1792918554722`  
**Session**: `session-1` / issue `issue-1` (`DEF-1`)

## Verification Results

- [x] Fresh test repository and Node-backed F1 server started on port 3600.
- [x] F1 issue and session were created.
- [x] The user selected `F1 Test Repository` and Cyrus created the selected worktree at `/tmp/cyrus-f1-1792918554722/worktrees/DEF-1`.
- [x] Cursor routing selected `cursor/composer-2`; Cyrus installed worktree-scoped Cursor permission hooks.
- [ ] `Agent.create()` completed and emitted real provider tool/result receipts.
- [ ] The requested proof file was created and read by Cursor.
- [ ] Continuation completed and emitted real provider tool/result receipts.
- [x] Continuation exercised the existing Cursor session identity via `Agent.resume()` and exposed the same provider boundary.
- [x] The F1 session stopped cleanly, permission hooks were removed, and the F1 server exited.

This drive is not a pass. Initialization and selected-worktree creation succeeded, but the Cursor provider did not start, no tool/result receipts were produced, and the marker file remained absent.

## Identity and Authentication Boundary

`CURSOR_API_KEY` was present for the F1 process and no credentials were added, changed, or refreshed. The local Cursor CLI reported:

```text
CLI Version         2026.04.28-e984b46
Subscription Tier   Unknown
User Email          Not logged in
```

The stored CLI identity was therefore `Not logged in`; the SDK launch used the existing API-key environment configured by Cyrus. The failure occurred before a request reached the provider, so this drive does not establish whether that credential would be accepted.

## Session Evidence

After repository selection, the runtime selected the requested worktree and began the Cursor launch path:

```text
Using model: cursor/composer-2
[CursorRunner] Installed Cyrus permission hooks at /tmp/cyrus-f1-1792918554722/worktrees/DEF-1/.cursor/hooks.json (allow=30, deny=2452, backup=no)
```

`@cursor/sdk` 1.0.40 then failed during `Agent.create()` while opening its default local state store outside the managed sandbox's writable roots:

```text
UnknownAgentError: EPERM: operation not permitted, mkdir '/Users/agentops/.cursor/projects/tmp-cyrus-f1-1792918554722-worktrees-DEF-1/sdk-agent-store/b8bd2a4aa7391357eafb693d9b03bd5f7097a59194edf28c408ff38ee9237a97'
operation: 'Agent.create'
```

The follow-up prompt reused Cursor session ID `cb2c3836-f30a-4c96-bbfc-92732efe151f` and exercised continuation:

```text
[resumeAgentSession] needsNewSession=false, resumeSessionId=cb2c3836-f30a-4c96-bbfc-92732efe151f
[CursorRunner] Resuming agent cb2c3836-f30a-4c96-bbfc-92732efe151f
UnknownAgentError: EPERM: operation not permitted, mkdir '/Users/agentops/.cursor/projects/tmp-cyrus-f1-1792918554722-worktrees-DEF-1/sdk-agent-store/b8bd2a4aa7391357eafb693d9b03bd5f7097a59194edf28c408ff38ee9237a97'
operation: 'Agent.resume'
```

The session activity stream contained repository-selection, routing, model, prompt, and error activities, but no provider `action`/tool-result pair. `cursor-f1-proof.txt` was absent. `stop-session` added the final response activity, removed `.cursor/hooks.json`, and changed the session to `complete`. Port 3600 was closed after server shutdown. The failed worktree and server log at `/private/tmp/cypack-1599-cursor-f1-3600.log` were retained for diagnosis, as required for failed F1 state.

## Writable-Store Follow-up

The original filesystem blocker was addressed narrowly on commit `fcc0a7ac6c26e5d38ab4d7406128c16323572c4b`. `CursorRunner` now opens `@cursor/sdk/sqlite`'s `SqliteLocalAgentStore` with the selected worktree as `workspaceRef` and a SHA-256-keyed `stateRoot` under the already-writable Cyrus home. The same store option is passed to both `Agent.create()` and `Agent.resume()` and disposed after each run.

Focused verification passed:

```text
pnpm --filter cyrus-cursor-runner test:run  # 45 passed
pnpm --filter cyrus-cursor-runner typecheck # passed
pnpm --filter cyrus-cursor-runner build     # passed
```

The follow-up F1 drive used a fresh repository at `/private/tmp/cypack-1599-cursor-f1-store-20261025-1612`, F1 home `/tmp/cyrus-f1-1792944656472`, issue `issue-1` / `DEF-1`, and session `session-1`. After the user selected `F1 Test Repository`, Cyrus created `/tmp/cyrus-f1-1792944656472/worktrees/DEF-1`, installed its worktree hooks, and opened the intended store:

```text
[CursorRunner] Installed Cyrus permission hooks at /tmp/cyrus-f1-1792944656472/worktrees/DEF-1/.cursor/hooks.json (allow=30, deny=2458, backup=no)
[CursorRunner] Opened Cursor SDK state store at /tmp/cyrus-f1-1792944656472/cursor-sdk-state/2fff44895bea04d15903dc524259c9d67f968d0be656b220289989be17862650
```

`index.db` was created at that path, proving the actual Cyrus launch no longer attempted to write under `~/.cursor`. `Agent.create()` then reached Cursor's authenticated model lookup and failed with the existing credential:

```text
AuthenticationError: Invalid User API Key
status: 401
endpoint: 'GET /v1/models'
requestId: 'c47f75e6-ff25-4f80-8f72-e3ad8260f811'
operation: 'Agent.create'
```

No credential, account, sandbox policy, or live runtime was changed. `agent status` and `agent about` still reported `Not logged in`; `CURSOR_API_KEY` remained present and unchanged.

The continuation path reopened the identical state root and installed hooks in the same selected worktree before calling `Agent.resume()`:

```text
[resumeAgentSession] needsNewSession=false, resumeSessionId=acac39d8-33d0-4cec-b717-6b55716d1247
[CursorRunner] Opened Cursor SDK state store at /tmp/cyrus-f1-1792944656472/cursor-sdk-state/2fff44895bea04d15903dc524259c9d67f968d0be656b220289989be17862650
[CursorRunner] Resuming agent acac39d8-33d0-4cec-b717-6b55716d1247
AgentNotFoundError: Agent acac39d8-33d0-4cec-b717-6b55716d1247 not found
operation: 'Agent.resume'
```

The resume target was not persisted because the initial authenticated create failed before returning an SDK agent. Consequently no provider tool/result receipts or proof file were produced. `stop-session` completed the F1 session, permission hooks were removed, and the server exited with port 3600 closed. The failed worktree, fixture-owned state, and `/private/tmp/cypack-1599-cursor-f1-store-3600.log` were retained for diagnosis.

## Disposition

The SDK state-directory blocker is resolved on the real Cyrus create and resume paths. Full runtime acceptance remains blocked until this scenario is repeated with a valid Cursor credential, producing real provider start, tool/result, and continuation receipts. No missing `connect-node` dependency or transport defect was reached or reproduced, so this report makes no such claim.
