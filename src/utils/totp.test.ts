import { describe, expect, test } from "bun:test";
import { generateTotp, generateTotpWithExpiry } from "./totp.js";

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

	describe("generateTotpWithExpiry", () => {
		test("returns code and remainingSeconds", () => {
			const secret = "JBSWY3DPEHPK3PXP";
			const result = generateTotpWithExpiry(secret);

			expect(result).not.toBeNull();
			expect(result?.code).toHaveLength(6);
			expect(/^\d{6}$/.test(result?.code as string)).toBe(true);
			expect(result?.remainingSeconds).toBeGreaterThan(0);
			expect(result?.remainingSeconds).toBeLessThanOrEqual(30);
		});

		test("returns null for empty input", () => {
			expect(generateTotpWithExpiry("")).toBeNull();
		});

		test("returns null for invalid secret", () => {
			expect(generateTotpWithExpiry("not-valid!")).toBeNull();
		});

		test("handles custom period from otpauth URI", () => {
			const uri = "otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP&period=60";
			const result = generateTotpWithExpiry(uri);

			expect(result).not.toBeNull();
			expect(result?.remainingSeconds).toBeGreaterThan(0);
			expect(result?.remainingSeconds).toBeLessThanOrEqual(60);
		});
	});
});
