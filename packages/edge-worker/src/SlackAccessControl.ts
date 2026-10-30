import type { SlackAccessControlConfig, UserIdentifier } from "cyrus-core";
import { type AccessCheckResult, userMatchesAny } from "./UserAccessControl.js";

/** Reply used when blockBehavior is 'reply' and no blockMessage is set. */
export const DEFAULT_SLACK_BLOCK_MESSAGE =
	"Sorry, you're not allowed to use this agent.";

function hasEmailIdentifier(
	identifiers: UserIdentifier[] | undefined,
): boolean {
	return (identifiers ?? []).some(
		(identifier) => typeof identifier === "object" && "email" in identifier,
	);
}

/** Whether checking access under this config needs the user's email address. */
export function slackAccessNeedsEmail(
	config: SlackAccessControlConfig,
): boolean {
	return (
		config.allowedEmailDomains !== undefined ||
		hasEmailIdentifier(config.allowedUsers) ||
		hasEmailIdentifier(config.blockedUsers)
	);
}

/**
 * Decide whether a Slack user may start or continue a session.
 *
 * 1. A user in `blockedUsers` is blocked.
 * 2. With no allow rule (`allowedUsers` and `allowedEmailDomains` both unset),
 *    everyone else is allowed.
 * 3. Otherwise the user must be in `allowedUsers` or have an email address in
 *    one of `allowedEmailDomains`. Domains match exactly, not subdomains.
 */
export function checkSlackAccess(
	config: SlackAccessControlConfig,
	userId: string | undefined,
	userEmail: string | undefined,
): AccessCheckResult {
	if (userMatchesAny(userId, userEmail, config.blockedUsers ?? [])) {
		return { allowed: false, reason: "User is in blocklist" };
	}

	if (
		config.allowedUsers === undefined &&
		config.allowedEmailDomains === undefined
	) {
		return { allowed: true };
	}

	if (userMatchesAny(userId, userEmail, config.allowedUsers ?? [])) {
		return { allowed: true };
	}

	const domain = userEmail?.split("@").pop()?.toLowerCase();
	if (
		domain &&
		config.allowedEmailDomains?.some(
			(allowed) => allowed.toLowerCase() === domain,
		)
	) {
		return { allowed: true };
	}

	return {
		allowed: false,
		reason: "User is not in allowedUsers or an allowed email domain",
	};
}
