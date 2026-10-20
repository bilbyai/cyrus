# CYPACK-1589: Claude Agent SDK 0.3.304 runtime acceptance

**Date:** 2026-10-20
**Goal:** Verify the upgraded Claude runner keeps Cyrus's explicit permission boundary and can execute a bounded authenticated Read/Bash turn end to end.
**Tested source:** `9cb20212dfb0caec7fc44a4688d41829589087bc` plus the CYPACK-1589 working-tree update to `@anthropic-ai/claude-agent-sdk` 0.3.304
**Test repository:** `/private/tmp/f1-cypack-1589-20261020`

## Changed-behavior assertions

- [x] F1 created `DEF-1`, accepted repository selection, and created its isolated worktree.
- [x] The runner initialized the SDK with the refreshed 30-tool registry.
- [x] The emitted `claude_query_options` event reported `cqo.permissionMode=default`, `cqo.hasCanUseTool=true`, and the expected project/user/local setting sources.
- [x] Routing, model, and error activities rendered coherently; the six-activity session view worked with `--limit 10 --offset 0`.
- [x] The stop signal was accepted and the F1 server shut down gracefully.
- [ ] The authenticated turn did not execute Read or Bash and did not return `SDK_RUNTIME_OK`.

## Session log

1. Started F1 on port 3600 with the fresh fixture repository; `ping` and `status` passed.
2. Created `DEF-1` with instructions to read `SDK_RUNTIME_FIXTURE.txt`, run `printf SDK_RUNTIME_OK`, and finish with `SDK_RUNTIME_OK`.
3. Started `session-1` and selected the sole configured repository.
4. F1 routed the issue, created `/tmp/cyrus-f1-1792483312309/worktrees/DEF-1`, and logged the 30-tool allowance list.
5. SDK initialization emitted `permissionMode: default` and assigned Claude session `7ee0268f-f53f-4bf6-9535-7358399430c3`.
6. The provider rejected the first model turn with `Failed to authenticate: OAuth token revoked. Please log in again or contact your administrator.`
7. Viewed the paginated session, sent the stop signal, and stopped the server cleanly.

## Final retrospective

The local SDK/runtime integration, permission policy, routing, worktree lifecycle, activity rendering, pagination, and shutdown paths passed. Full runtime acceptance remains blocked by the existing Claude OAuth credential being revoked server-side: `claude auth status` reports a stored Claude.ai login, but an actual model request rejects it. The account owner must run `claude auth login --claudeai`, verify a real request, and rerun this bounded scenario before the PR is ready. Required completion evidence is successful Read and Bash tool output, final `SDK_RUNTIME_OK`, no error result, and clean stop.
