# Test Drive: CYPACK-1602 Anthropic SDK Smoke

**Date**: 2026-10-27
**Goal**: Verify issue routing, EdgeWorker startup, activity rendering, pagination, and clean shutdown with Claude Agent SDK `0.3.311` and Anthropic SDK `1.3.0`.
**Test Repo**: `/tmp/cypack-1602-f1.tQKZe6`

## Verification Results

### Issue-Tracker
- [x] Issue created
- [x] Issue ID returned
- [x] Issue metadata accessible

### EdgeWorker
- [x] Session started
- [x] Worktree created from local `main`
- [x] Activities tracked
- [x] Claude Agent SDK `0.3.311` assigned a Claude session ID
- [ ] Provider inference completed (blocked by the machine's expired Claude OAuth token)
- [x] Session stopped cleanly

### Renderer
- [x] Elicitation, prompt, thought, and error activities rendered coherently
- [x] Activity timestamps were present
- [x] Pagination worked with `--limit 10 --offset 0` and `--limit 10 --offset 10`

## Session Log

```bash
apps/f1/f1 init-test-repo --path /tmp/cypack-1602-f1.tQKZe6
CYRUS_PORT=3617 CYRUS_REPO_PATH=/tmp/cypack-1602-f1.tQKZe6 bun run apps/f1/server.ts
CYRUS_PORT=3617 apps/f1/f1 ping
CYRUS_PORT=3617 apps/f1/f1 status
```

Result: the test repository was created, the server started, RPC health passed, and status reported `ready`.

```bash
CYRUS_PORT=3617 apps/f1/f1 create-issue \
  --title "Verify Claude Agent SDK 0.3.311 runtime" \
  --description "Inspect the rate limiter package and report which algorithms are implemented. Do not modify files."
CYRUS_PORT=3617 apps/f1/f1 start-session --issue-id issue-1
CYRUS_PORT=3617 apps/f1/f1 prompt-session --session-id session-1 \
  --message "/tmp/cypack-1602-f1.tQKZe6"
```

Result: repository selection completed, the EdgeWorker created the `DEF-1` worktree, loaded 30 refreshed tools, invoked Claude Agent SDK `0.3.311`, and assigned Claude session `dfae8bc6-db02-42bf-b4b0-16b901e303e8`. The provider then returned `401 OAuth access token has expired`, so inference could not continue in this environment.

```bash
CYRUS_PORT=3617 apps/f1/f1 view-session --session-id session-1 --limit 10 --offset 0
CYRUS_PORT=3617 apps/f1/f1 view-session --session-id session-1 --limit 10 --offset 10
CYRUS_PORT=3617 apps/f1/f1 stop-session --session-id session-1
```

Result: six activities rendered with timestamps; the second page correctly contained no activities; the session and server stopped cleanly.

## Final Retrospective

The updated SDK graph preserved issue creation, repository selection, worktree creation, runner startup, session-ID assignment, activity rendering, pagination, and shutdown. Full provider inference remains blocked by an expired external OAuth credential rather than an SDK or Cyrus regression. Package tests, runner package-contract verification, and the clean-consumer prerelease installation provide the credential-independent runtime coverage.
