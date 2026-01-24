import { randomInt } from "node:crypto";
import generatePassphraseWords from "eff-diceware-passphrase";

export interface RandomPasswordOptions {
	length: number;
	uppercase: boolean;
	lowercase: boolean;
	number: boolean;
	special: boolean;
}

export interface PassphraseOptions {
	words: number;
	separator: string;
	capitalize: boolean;
	includeNumber: boolean;
}

export interface PasswordOptions {
	type: "random" | "passphrase";
	// Random options
	length?: number;
	uppercase?: boolean;
	lowercase?: boolean;
	number?: boolean;
	special?: boolean;
	// Passphrase options
	words?: number;
	separator?: string;
	capitalize?: boolean;
	includeNumber?: boolean;
}

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";
const SPECIAL = "!@#$%^&*()_+-=[]{}|;:,.<>?";

/**
 * Generate a cryptographically secure random password.
 * Uses Node's crypto.randomInt for secure randomness.
 */
export function generateRandomPassword(options: RandomPasswordOptions): string {
	let charset = "";
	if (options.uppercase) charset += UPPERCASE;
	if (options.lowercase) charset += LOWERCASE;
	if (options.number) charset += NUMBERS;
	if (options.special) charset += SPECIAL;

	if (charset.length === 0) {
		charset = LOWERCASE + NUMBERS;
	}

	const chars: string[] = [];
	for (let i = 0; i < options.length; i++) {
		const idx = randomInt(0, charset.length);
		chars.push(charset[idx]);
	}

	return chars.join("");
}

/**
 * Generate a random number suffix for passphrase words.
 * Returns 0-1 digits randomly (50% chance of a single digit).
 */
function generateNumberSuffix(): string {
	// 50% chance of adding a digit
	if (randomInt(0, 2) === 0) {
		return "";
	}
	return randomInt(0, 10).toString();
}

/**
 * Generate a cryptographically secure passphrase.
 * Uses EFF's improved Diceware wordlist (7776 words, ~12.9 bits/word).
 */
export function generatePassphrase(options: PassphraseOptions): string {
	const wordCount = Math.max(3, options.words);
	const words: string[] = generatePassphraseWords(wordCount);

	const formattedWords = words.map((word) => {
		let formatted = word;

		if (options.capitalize) {
			formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
		}

		if (options.includeNumber) {
			formatted += generateNumberSuffix();
		}

		return formatted;
	});

	return formattedWords.join(options.separator);
}

/**
 * Generate a password based on options.
 * Unified interface for both random and passphrase generation.
 */
export function generatePassword(options: PasswordOptions): {
	success: boolean;
	password?: string;
	error?: string;
} {
	try {
		let password: string;

		if (options.type === "passphrase") {
			password = generatePassphrase({
				words: options.words ?? 5,
				separator: options.separator ?? "-",
				capitalize: options.capitalize ?? true,
				includeNumber: options.includeNumber ?? true,
			});
		} else {
			password = generateRandomPassword({
				length: options.length ?? 16,
				uppercase: options.uppercase ?? true,
				lowercase: options.lowercase ?? true,
				number: options.number ?? true,
				special: options.special ?? true,
			});
		}

		return { success: true, password };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return { success: false, error: `Password generation failed: ${message}` };
	}
}
