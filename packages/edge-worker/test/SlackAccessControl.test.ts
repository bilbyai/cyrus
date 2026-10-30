import { describe, expect, it } from "vitest";
import {
	checkSlackAccess,
	slackAccessNeedsEmail,
} from "../src/SlackAccessControl.js";

describe("checkSlackAccess", () => {
	it("allows everyone when no allow rule is set", () => {
		expect(checkSlackAccess({}, "U1", undefined).allowed).toBe(true);
	});

	it("allows an email in an allowed domain, ignoring case", () => {
		const config = { allowedEmailDomains: ["Example.com"] };
		expect(checkSlackAccess(config, "U1", "ana@example.COM").allowed).toBe(
			true,
		);
	});

	it("refuses an email outside the allowed domains", () => {
		const config = { allowedEmailDomains: ["example.com"] };
		expect(checkSlackAccess(config, "U1", "ana@other.com").allowed).toBe(false);
	});

	it("does not treat a subdomain as the allowed domain", () => {
		const config = { allowedEmailDomains: ["example.com"] };
		expect(checkSlackAccess(config, "U1", "ana@mail.example.com").allowed).toBe(
			false,
		);
	});

	it("refuses a user with no email when domains are the only allow rule", () => {
		const config = { allowedEmailDomains: ["example.com"] };
		expect(checkSlackAccess(config, "U1", undefined).allowed).toBe(false);
	});

	it("allows a listed user outside the allowed domains", () => {
		const config = {
			allowedEmailDomains: ["example.com"],
			allowedUsers: ["U2", { email: "guest@partner.com" }],
		};
		expect(checkSlackAccess(config, "U2", "u2@partner.com").allowed).toBe(true);
		expect(checkSlackAccess(config, "U3", "guest@partner.com").allowed).toBe(
			true,
		);
	});

	it("blocks a blocked user even inside an allowed domain", () => {
		const config = {
			allowedEmailDomains: ["example.com"],
			blockedUsers: [{ email: "ana@example.com" }],
		};
		expect(checkSlackAccess(config, "U1", "ana@example.com")).toEqual({
			allowed: false,
			reason: "User is in blocklist",
		});
	});

	it("refuses everyone when allowedUsers is empty and no domain is set", () => {
		expect(
			checkSlackAccess({ allowedUsers: [] }, "U1", "a@b.com").allowed,
		).toBe(false);
	});
});

describe("slackAccessNeedsEmail", () => {
	it("needs no email for ID-only rules", () => {
		expect(
			slackAccessNeedsEmail({ allowedUsers: ["U1"], blockedUsers: ["U2"] }),
		).toBe(false);
	});

	it("needs an email for domain rules or email identifiers", () => {
		expect(slackAccessNeedsEmail({ allowedEmailDomains: [] })).toBe(true);
		expect(
			slackAccessNeedsEmail({ blockedUsers: [{ email: "a@b.com" }] }),
		).toBe(true);
	});
});
