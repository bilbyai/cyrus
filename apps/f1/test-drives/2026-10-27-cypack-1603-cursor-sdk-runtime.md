# CYPACK-1603 Cursor SDK Runtime Acceptance

**Date**: 2026-10-27  
**Result**: BLOCKED — state-store compatibility passed, but provider acceptance remains blocked by the configured invalid Cursor API key  
**Goal**: Exercise Cursor SDK 1.1.0 create, tool/result, continuation, and stop behavior after removing its vulnerable Zod dependency.  
**Tested source commit**: `5eea43ff`  
**Installed SDK**: `@cursor/sdk` 1.1.0  
**Test repository**: `/private/tmp/cypack-1603-f1-20261027`  
**F1 home**: `/tmp/cyrus-f1-1793085658994`  
**Session**: `session-1` / issue `issue-1` (`DEF-1`)

## Verification Results

- [x] F1 server started on port 3600, reported healthy, and created the issue and session.
- [x] Repository selection created `/tmp/cyrus-f1-1793085658994/worktrees/DEF-1`.
- [x] The `[agent=cursor] [model=default]` selectors routed through Cursor SDK 1.1.0.
- [x] Create and continuation both installed worktree-scoped permission hooks.
- [x] Create and continuation both opened the same SQLite store under the fixture-owned Cyrus home.
- [x] `index.db` was created under that store; neither path attempted to write under global `~/.cursor`.
- [ ] `Agent.create()` completed and emitted provider tool/result receipts.
- [ ] The requested create proof file was written and read.
- [ ] `Agent.resume()` completed and emitted provider tool/result receipts.
- [ ] The requested continuation proof file was written and read.
- [x] Stop completed, permission hooks were removed, and port 3600 closed after graceful server shutdown.

## Session Evidence

The real Cyrus start path selected the intended worktree and opened the SDK store at the expected SHA-256-keyed location:

```text
[CursorRunner] Installed Cyrus permission hooks at /tmp/cyrus-f1-1793085658994/worktrees/DEF-1/.cursor/hooks.json (allow=30, deny=3342, backup=no)
[CursorRunner] Opened Cursor SDK state store at /tmp/cyrus-f1-1793085658994/cursor-sdk-state/69f929c8c826f6c714f4664b935a8f715e185ba43d66e27ad0a52478e3b94cf9
```

`index.db`, `index.db-shm`, and `index.db-wal` were present in that directory. `Agent.create()` then reached Cursor's authenticated model lookup and failed before provider execution:

```text
AuthenticationError: Invalid User API Key
status: 401
endpoint: GET /v1/models
requestId: cae47b74-a28e-4c0e-83ab-70c56a27ec59
operation: Agent.create
```

No credential, account, sandbox policy, or live runtime was changed. The requested `cursor-f1-proof.txt` was absent, and the session timeline correctly rendered the authentication error.

The continuation path reused the same worktree and state root before attempting the existing Cyrus session ID:

```text
[resumeAgentSession] needsNewSession=false, resumeSessionId=3f8f41d4-9b7d-425f-a54a-2666e90cb8bb
[CursorRunner] Opened Cursor SDK state store at /tmp/cyrus-f1-1793085658994/cursor-sdk-state/69f929c8c826f6c714f4664b935a8f715e185ba43d66e27ad0a52478e3b94cf9
[CursorRunner] Resuming agent 3f8f41d4-9b7d-425f-a54a-2666e90cb8bb
AgentNotFoundError: Agent 3f8f41d4-9b7d-425f-a54a-2666e90cb8bb not found
operation: Agent.resume
```

The initial authentication failure prevented `Agent.create()` from returning and persisting an SDK agent, so the resume target did not exist and no provider tool/result receipts or continuation proof file could be produced.

## Disposition

The SDK 1.1.0 compatibility change is verified on the actual Cyrus create and continuation paths: scalar `cwd`, fixture-owned state, the same store on resume, and clean disposal/stop all behaved as intended. Full runtime acceptance remains blocked until the bounded scenario is rerun with a valid Cursor credential and produces create, tool/result, and continuation receipts. The failed fixture and state were preserved for diagnosis.
