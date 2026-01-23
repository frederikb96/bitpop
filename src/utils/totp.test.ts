import { describe, expect, test } from "bun:test";
import { generateTotp } from "./totp.js";

describe("totp", () => {
	describe("generateTotp", () => {
		test("returns null for empty input", () => {
			expect(generateTotp("")).toBeNull();
		});

		test("generates TOTP from plain base32 secret", () => {
			const secret = "JBSWY3DPEHPK3PXP"; // Standard test secret
			const result = generateTotp(secret);

			expect(result).not.toBeNull();
			expect(result).toHaveLength(6);
			expect(/^\d{6}$/.test(result as string)).toBe(true);
		});

		test("generates TOTP from otpauth URI", () => {
			const uri =
				"otpauth://totp/Test:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Test";
			const result = generateTotp(uri);

			expect(result).not.toBeNull();
			expect(result).toHaveLength(6);
			expect(/^\d{6}$/.test(result as string)).toBe(true);
		});

		test("handles otpauth URI with custom digits", () => {
			const uri = "otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP&digits=8";
			const result = generateTotp(uri);

			expect(result).not.toBeNull();
			expect(result).toHaveLength(8);
			expect(/^\d{8}$/.test(result as string)).toBe(true);
		});

		test("returns null for steam:// URIs (not supported)", () => {
			const steamUri = "steam://JBSWY3DPEHPK3PXP";
			const result = generateTotp(steamUri);

			expect(result).toBeNull();
		});

		test("returns null for invalid secret", () => {
			const result = generateTotp("not-a-valid-base32!");

			expect(result).toBeNull();
		});
	});
});
