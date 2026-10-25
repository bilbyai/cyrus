# CYPACK-1600: Claude Agent SDK 0.3.310 carry-forward verification

**Date:** 2026-10-25  
**Goal:** Supersede the pending SDK update with current-main packages, a fresh npm test release, and a Hosted pin that uses the refreshed Claude tool defaults.

## Scope and F1 disposition

The Claude runner, core tool defaults, edge-worker sandbox assertion, and installed-package verifier are byte-for-byte identical to the source exercised by the CYPACK-1598 F1 run in `2026-10-24-cypack-1598-sdk-runtime.md`. That run initialized Agent SDK 0.3.310, confirmed the 30-tool built-in registry and explicit `permissionMode: default`, exercised routing and lifecycle handling, and carried forward the authenticated Read/Bash acceptance from `2026-10-23-cypack-1596-sdk-runtime.md`. The only newer `main` commit moves the separately maintained Cyrus event plugin package and does not change the runner path, so a duplicate live provider turn is not required.

## Current verification

- [x] npm reports `@anthropic-ai/claude-agent-sdk@0.3.310` and `@anthropic-ai/sdk@1.3.0` as current.
- [x] `./scripts/extract-claude-tools.sh` reported the same 30 built-in tools represented by `packages/claude-runner/src/config.ts`; the additional reported names were injected MCP tools, not Claude built-ins.
- [x] Published `cyrus-core@0.2.75-test.5` and corrected `cyrus-claude-runner@0.2.75-test.4` under the npm `test` tag without moving either `latest` tag.
- [x] A clean registry install imported core, exposed 34 Linear defaults with `TaskStop` and without retired `TaskOutput`, and passed `npm audit` with zero vulnerabilities.
- [x] The installed runner package passed the permission contract for first-party, Bedrock, Vertex, Foundry, telemetry-disabled, and do-not-track configurations.
- [x] The intermediate runner prerelease `0.2.75-test.3` was deprecated after clean-install verification found its workspace dependency had rewritten to unpublished `cyrus-core@0.2.74`.
- [x] Monorepo build, typecheck, lint, all package suites, CLI tests, and dependency audit passed.

Primary change records: [Agent SDK 0.3.310](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md#03310) and [Anthropic SDK 1.3.0](https://github.com/anthropics/anthropic-sdk-typescript/releases/tag/sdk-v1.3.0).
