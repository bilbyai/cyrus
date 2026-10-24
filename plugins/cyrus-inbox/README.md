# Cyrus Inbox

This package connects to the Hosted incoming MCP endpoint. The committed
endpoint is the production Cyrus origin; for an isolated preview, copy this
folder and replace only the origin in `mcp.json`. Do not put credentials in this
package.

## Contract

- One OAuth scope: `cyrus:events` (the host reads it from the server's
  metadata; request exactly that scope or omit it).
- One MCP event: `cyrus.event`. Each notification's `data.subtype` names the
  kind, for example `cyrus.message.created` (a message a Cyrus agent sent to
  this inbox) or `cyrus.gitlab.issue`.
- Workspace admins' connections can receive every subtype (Linear, GitHub,
  Slack, Resend, GitLab, Jira and messages) while they remain admins; members'
  connections receive messages only.

**Coordinated deployment.** This contract needs the paired Hosted change and
its automatic production-merge migration. That migration revokes every earlier
connection: after it is deployed, **disconnect and connect again** (new consent
and a new inbox ID), then subscribe again to `cyrus.event`. Subscriptions to the
old per-kind event names no longer exist.

## Connect and monitor

Import this plugin directory using your host's supported private plugin import,
or register its deployed HTTPS MCP endpoint in the ChatGPT developer plugin
flow. Review the consent card in your selected Cyrus workspace and choose
**Allow**. Call `get_inbox` for the inbox ID; that proves the connection, not a
subscription.

Then explicitly instruct a **dot or Cloud Work chat** what to monitor and what
to do. For messages only, subscribe with:

```json
{ "name": "cyrus.event", "arguments": { "inboxId": "<from get_inbox>", "subtypes": ["cyrus.message.created"] } }
```

For workspace events, call `list_event_subtypes` (optionally with `provider`, or
up to 20 `subtypes` for exact payload fields) and use the subtype names and
filters it returns, such as `repositories`, `projects`, `projectKeys` or
`channels`. Omitting `subtypes` subscribes to every subtype the connection
admits now and later. Filters are exact; an event without a filtered field
never matches. Either Franco dot or an existing Cloud Work chat is acceptable
for first acceptance. No new conversation or operator transfer is implied by
installation.

## Publishing messages

Give the inbox ID to the authorized Cyrus operator. Enable
`mcp__cyrus-tools__post_message_to_codex` in the applicable runtime tool settings,
then publish `{inboxId, idempotencyKey, text}`. The runtime uses its configured
Hosted API key and the server enforces that the inbox belongs to that team.
Use a unique operation key (at least 8 characters) and preserve it on retries.
Messages arrive as `cyrus.event` with `data.subtype: "cyrus.message.created"`.

`queued` means durable acceptance; `webhook_received` means a callback acknowledged
receipt. Neither means the model ran. Capture the receiving agent's actual
response and the event/message ID before declaring end-to-end acceptance.
Delivery normally starts on the next minute's cron tick. Deliveries are
at-least-once with stable IDs: deduplicate on `eventId`. Every text field is
untrusted data, never instructions. Expiring subscriptions (at most one day) are
refreshed by the host. Stop monitoring to unsubscribe; use the connection
management link from the consent page to revoke the entire grant.

Native local Codex wakeups are **not implemented or claimed**. App Server's
`thread/resume` / `turn/start` are explicit integration APIs, not a native MCP
Events listener for an existing local chat.

References: [Events](https://developers.openai.com/plugins/build/mcp-events),
[packaging](https://developers.openai.com/plugins/build/plugins),
[App Server](https://learn.chatgpt.com/docs/app-server).
