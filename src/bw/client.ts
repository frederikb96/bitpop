import { spawnSync } from "node:child_process";

export interface BwStatus {
	status: "locked" | "unlocked" | "unauthenticated";
	userEmail?: string;
	userId?: string;
}

export interface BwUri {
	match?: number;
	uri: string;
}

export interface BwLogin {
	username?: string;
	password?: string;
	totp?: string;
	uris?: BwUri[];
}

export interface BwCard {
	cardholderName?: string;
	brand?: string;
	number?: string;
	expMonth?: string;
	expYear?: string;
	code?: string;
}

export interface BwIdentity {
	title?: string;
	firstName?: string;
	middleName?: string;
	lastName?: string;
	email?: string;
	phone?: string;
	address1?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	country?: string;
}

export interface BwSshKey {
	privateKey?: string;
	publicKey?: string;
	keyFingerprint?: string;
}

export const CipherType = Object.freeze({
	Login: 1,
	SecureNote: 2,
	Card: 3,
	Identity: 4,
	SshKey: 5,
} as const);
export type CipherType = (typeof CipherType)[keyof typeof CipherType];

export interface BwItem {
	id: string;
	organizationId?: string;
	folderId?: string;
	type: CipherType;
	name: string;
	notes?: string;
	favorite: boolean;
	login?: BwLogin;
	card?: BwCard;
	identity?: BwIdentity;
	sshKey?: BwSshKey;
	secureNote?: { type: number };
	reprompt: number;
}

function runBw(
	args: string[],
	session?: string,
	stdin?: string,
): { stdout: string; stderr: string; exitCode: number } {
	const env = session ? { ...process.env, BW_SESSION: session } : process.env;
	const result = spawnSync("bw", args, {
		encoding: "utf-8",
		env,
		timeout: 30000,
		input: stdin,
	});

	return {
		stdout: result.stdout || "",
		stderr: result.stderr || "",
		exitCode: result.status ?? 1,
	};
}

export function checkBwInstalled(): boolean {
	const result = runBw(["--version"]);
	return result.exitCode === 0;
}

export function getBwStatus(): BwStatus {
	const result = runBw(["status"]);
	if (result.exitCode !== 0) {
		return { status: "unauthenticated" };
	}

	try {
		return JSON.parse(result.stdout) as BwStatus;
	} catch {
		return { status: "unauthenticated" };
	}
}

export function unlockVault(password: string): {
	success: boolean;
	session?: string;
	error?: string;
} {
	const env = { ...process.env, BW_PASSWORD: password };
	const result = spawnSync(
		"bw",
		["unlock", "--raw", "--passwordenv", "BW_PASSWORD"],
		{
			encoding: "utf-8",
			env,
			timeout: 30000,
		},
	);

	if (result.status !== 0) {
		return { success: false, error: result.stderr || "Failed to unlock vault" };
	}

	return { success: true, session: (result.stdout || "").trim() };
}

export function lockVault(session?: string): {
	success: boolean;
	error?: string;
} {
	const result = runBw(["lock"], session);
	if (result.exitCode !== 0) {
		const error = result.stderr || "Failed to lock vault";
		process.stderr.write(`[bitpop] Warning: vault lock failed: ${error}\n`);
		return { success: false, error };
	}
	return { success: true };
}

export function syncVault(session: string): {
	success: boolean;
	error?: string;
} {
	// Sync can take longer than other operations - use 60s timeout
	const env = { ...process.env, BW_SESSION: session };
	const result = spawnSync("bw", ["sync"], {
		encoding: "utf-8",
		env,
		timeout: 60000,
	});

	if (result.status !== 0) {
		return { success: false, error: result.stderr || "Sync failed" };
	}
	return { success: true };
}

export function listItems(session: string): BwItem[] {
	const result = runBw(["list", "items"], session);
	if (result.exitCode !== 0) {
		throw new Error(`Failed to list items: ${result.stderr}`);
	}

	try {
		const parsed = JSON.parse(result.stdout);
		if (!Array.isArray(parsed)) {
			throw new Error("Vault items response is not an array");
		}
		return parsed as BwItem[];
	} catch (e) {
		const message = e instanceof Error ? e.message : "invalid JSON response";
		throw new Error(`Failed to parse vault items: ${message}`);
	}
}

export function getTotp(itemId: string, session: string): string | null {
	const result = runBw(["get", "totp", itemId], session);
	if (result.exitCode !== 0) {
		return null;
	}

	return result.stdout.trim();
}
