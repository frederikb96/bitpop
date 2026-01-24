import { describe, expect, test } from "bun:test";
import {
	generatePassphrase,
	generatePassword,
	generateRandomPassword,
} from "./password.js";

describe("generateRandomPassword", () => {
	test("generates password of correct length", () => {
		const password = generateRandomPassword({
			length: 16,
			uppercase: true,
			lowercase: true,
			number: true,
			special: true,
		});
		expect(password.length).toBe(16);
	});

	test("respects length option", () => {
		const password = generateRandomPassword({
			length: 32,
			uppercase: true,
			lowercase: true,
			number: true,
			special: true,
		});
		expect(password.length).toBe(32);
	});

	test("uses only lowercase when specified", () => {
		const password = generateRandomPassword({
			length: 50,
			uppercase: false,
			lowercase: true,
			number: false,
			special: false,
		});
		expect(password).toMatch(/^[a-z]+$/);
	});

	test("uses only uppercase when specified", () => {
		const password = generateRandomPassword({
			length: 50,
			uppercase: true,
			lowercase: false,
			number: false,
			special: false,
		});
		expect(password).toMatch(/^[A-Z]+$/);
	});

	test("uses only numbers when specified", () => {
		const password = generateRandomPassword({
			length: 50,
			uppercase: false,
			lowercase: false,
			number: true,
			special: false,
		});
		expect(password).toMatch(/^[0-9]+$/);
	});

	test("generates different passwords each time", () => {
		const options = {
			length: 32,
			uppercase: true,
			lowercase: true,
			number: true,
			special: true,
		};
		const password1 = generateRandomPassword(options);
		const password2 = generateRandomPassword(options);
		expect(password1).not.toBe(password2);
	});
});

describe("generatePassphrase", () => {
	test("generates correct number of words", () => {
		const passphrase = generatePassphrase({
			words: 5,
			separator: "-",
			capitalize: false,
			includeNumber: false,
		});
		const words = passphrase.split("-");
		expect(words.length).toBe(5);
	});

	test("respects separator option", () => {
		const passphrase = generatePassphrase({
			words: 3,
			separator: "_",
			capitalize: false,
			includeNumber: false,
		});
		expect(passphrase).toContain("_");
		expect(passphrase).not.toContain("-");
	});

	test("capitalizes first letter when enabled", () => {
		const passphrase = generatePassphrase({
			words: 5,
			separator: "-",
			capitalize: true,
			includeNumber: false,
		});
		const words = passphrase.split("-");
		for (const word of words) {
			expect(word[0]).toMatch(/[A-Z]/);
		}
	});

	test("includes numbers when enabled (0-1 digits per word)", () => {
		// Generate multiple times to verify some words get numbers
		let hasNumberedWord = false;
		let hasPlainWord = false;
		for (let i = 0; i < 20; i++) {
			const passphrase = generatePassphrase({
				words: 5,
				separator: "-",
				capitalize: false,
				includeNumber: true,
			});
			const words = passphrase.split("-");
			for (const word of words) {
				if (/\d$/.test(word)) hasNumberedWord = true;
				if (!/\d$/.test(word)) hasPlainWord = true;
			}
		}
		// Should have both numbered and plain words across multiple generations
		expect(hasNumberedWord).toBe(true);
		expect(hasPlainWord).toBe(true);
	});

	test("combines capitalize and includeNumber", () => {
		const passphrase = generatePassphrase({
			words: 4,
			separator: "-",
			capitalize: true,
			includeNumber: true,
		});
		const words = passphrase.split("-");
		for (const word of words) {
			// First char uppercase (always)
			expect(word[0]).toMatch(/[A-Z]/);
			// May or may not have number at end (0-1 digits)
		}
	});

	test("minimum word count is 3", () => {
		const passphrase = generatePassphrase({
			words: 1,
			separator: "-",
			capitalize: false,
			includeNumber: false,
		});
		const words = passphrase.split("-");
		expect(words.length).toBe(3);
	});

	test("generates different passphrases each time", () => {
		const options = {
			words: 5,
			separator: "-",
			capitalize: true,
			includeNumber: true,
		};
		const p1 = generatePassphrase(options);
		const p2 = generatePassphrase(options);
		expect(p1).not.toBe(p2);
	});
});

describe("generatePassword", () => {
	test("generates random password when type is random", () => {
		const result = generatePassword({
			type: "random",
			length: 16,
			uppercase: true,
			lowercase: true,
			number: true,
			special: true,
		});
		expect(result.success).toBe(true);
		expect(result.password?.length).toBe(16);
	});

	test("generates passphrase when type is passphrase", () => {
		const result = generatePassword({
			type: "passphrase",
			words: 4,
			separator: "-",
			capitalize: true,
			includeNumber: true,
		});
		expect(result.success).toBe(true);
		expect(result.password).toContain("-");
		const words = result.password?.split("-") ?? [];
		expect(words.length).toBe(4);
	});

	test("uses default options when not specified", () => {
		const result = generatePassword({ type: "random" });
		expect(result.success).toBe(true);
		expect(result.password?.length).toBe(16);
	});

	test("uses default passphrase options when not specified", () => {
		const result = generatePassword({ type: "passphrase" });
		expect(result.success).toBe(true);
		const words = result.password?.split("-") ?? [];
		expect(words.length).toBe(5);
	});
});
