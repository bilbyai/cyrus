# CYPACK-1595: Claude Agent SDK 0.3.308 runtime acceptance

**Date:** 2026-10-22
**Goal:** Verify the upgraded Claude runner keeps Cyrus's explicit permission boundary and can execute a bounded authenticated Read/Bash turn end to end.
**Tested source:** `a18454f76a400bbd6979328a97aca833411a40c2`
**Test repository:** `/private/tmp/f1-cypack-1595-20261022`

## Changed-behavior assertions

- [x] F1 created `DEF-1`, accepted repository selection, and created its isolated worktree.
- [x] The runner initialized Claude Agent SDK 0.3.308 with the refreshed 30-tool registry.
- [x] The emitted `claude_query_options` event reported `cqo.permissionMode=default`, `cqo.hasCanUseTool=true`, and the expected project/user/local setting sources.
- [x] Routing, model, and error activities rendered coherently; the six-activity session view worked with `--limit 10 --offset 0`.
- [x] The stop signal was accepted and the F1 server shut down gracefully.
- [ ] The authenticated turn did not execute Read or Bash and did not return `SDK_RUNTIME_OK`.

## Session log

1. Started F1 on port 3600 with the fresh fixture repository; `ping` and `status` passed.
2. Created `DEF-1` with instructions to read `SDK_RUNTIME_FIXTURE.txt`, run `printf SDK_RUNTIME_OK`, and finish with `SDK_RUNTIME_OK`.
3. Started `session-1` and selected the sole configured repository.
4. F1 routed the issue, created `/tmp/cyrus-f1-1792653865038/worktrees/DEF-1`, and logged the 30-tool allowance list.
5. SDK initialization emitted `permissionMode: default` and assigned Claude session `76ed7c7a-c8a8-4877-97c6-f5b1f55589cb`.
6. The provider rejected the model turn with `Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.`
7. Viewed the paginated session, sent the stop signal, and stopped the server cleanly.

## Final retrospective

The local SDK/runtime integration, permission policy, routing, worktree lifecycle, activity rendering, pagination, and shutdown paths passed. Full runtime acceptance remains blocked by the existing Claude OAuth credential being expired server-side: `claude auth status` reports a stored Claude.ai login, but an actual model request rejects it. The account owner must run `claude auth login --claudeai`, verify a real request, and rerun this bounded scenario before the PR is ready. Required completion evidence is successful Read and Bash tool output, final `SDK_RUNTIME_OK`, no error result, and clean stop.
