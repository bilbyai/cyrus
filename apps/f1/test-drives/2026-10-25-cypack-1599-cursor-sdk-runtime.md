# CYPACK-1599 Cursor SDK Runtime Acceptance

**Date**: 2026-10-25  
**Result**: BLOCKED — runtime acceptance was not established  
**Goal**: Exercise Cursor selected-worktree start, tool/result activity, continuation, and stop after upgrading `@cursor/sdk` from 1.0.19 to 1.0.40 and changing `local.cwd` from an array to a scalar.  
**Tested source commit**: `8c55681b39a75431904785e96f3b03a75daedb3e`  
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

## Disposition

The upgrade's Cursor runtime acceptance remains blocked until this scenario is repeated in an environment where the SDK can create its local state store, producing real start, tool/result, continuation, and stop receipts. The observed boundary is an `EPERM` on the SDK's default state directory; no missing `connect-node` dependency or transport defect was reached or reproduced, so this report makes no such claim.

