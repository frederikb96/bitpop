import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("bw/client", () => {
	let mockSpawnSync: ReturnType<typeof mock>;

	beforeEach(() => {
		mockSpawnSync = mock(() => ({
			stdout: "",
			stderr: "",
			status: 0,
		}));
	});

	afterEach(() => {
		mockSpawnSync.mockRestore();
	});

	describe("getBwStatus", () => {
		test("parses locked status from JSON response", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: JSON.stringify({
					status: "locked",
					userEmail: "user@test.com",
				}),
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { getBwStatus } = await import(`./client.js?t=${Date.now()}`);
			const result = getBwStatus();

			expect(result.status).toBe("locked");
			expect(result.userEmail).toBe("user@test.com");
		});

		test("parses unlocked status from JSON response", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: JSON.stringify({
					status: "unlocked",
					userEmail: "user@test.com",
					userId: "abc123",
				}),
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { getBwStatus } = await import(`./client.js?t=${Date.now()}`);
			const result = getBwStatus();

			expect(result.status).toBe("unlocked");
			expect(result.userId).toBe("abc123");
		});

		test("returns unauthenticated on non-zero exit code", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "Not logged in",
				status: 1,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { getBwStatus } = await import(`./client.js?t=${Date.now()}`);
			const result = getBwStatus();

			expect(result.status).toBe("unauthenticated");
		});

		test("returns unauthenticated on invalid JSON", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "not valid json {",
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { getBwStatus } = await import(`./client.js?t=${Date.now()}`);
			const result = getBwStatus();

			expect(result.status).toBe("unauthenticated");
		});
	});

	describe("unlockVault", () => {
		test("returns session on success", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "session-token-abc123\n",
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { unlockVault } = await import(`./client.js?t=${Date.now()}`);
			const result = unlockVault("password123");

			expect(result.success).toBe(true);
			expect(result.session).toBe("session-token-abc123");
			expect(result.error).toBeUndefined();
		});

		test("returns error on failure", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "Invalid master password",
				status: 1,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { unlockVault } = await import(`./client.js?t=${Date.now()}`);
			const result = unlockVault("wrongpassword");

			expect(result.success).toBe(false);
			expect(result.session).toBeUndefined();
			expect(result.error).toBe("Invalid master password");
		});

		test("returns generic error when stderr is empty", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "",
				status: 1,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { unlockVault } = await import(`./client.js?t=${Date.now()}`);
			const result = unlockVault("password");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Failed to unlock vault");
		});
	});

	describe("listItems", () => {
		test("returns parsed array of items", async () => {
			const items = [
				{ id: "1", name: "Item 1", type: 1, favorite: false, reprompt: 0 },
				{ id: "2", name: "Item 2", type: 1, favorite: true, reprompt: 0 },
			];

			mockSpawnSync.mockImplementation(() => ({
				stdout: JSON.stringify(items),
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { listItems } = await import(`./client.js?t=${Date.now()}`);
			const result = listItems("session123");

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("Item 1");
			expect(result[1].favorite).toBe(true);
		});

		test("throws on non-zero exit code", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "Session expired",
				status: 1,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { listItems } = await import(`./client.js?t=${Date.now()}`);

			expect(() => listItems("bad-session")).toThrow("Failed to list items");
		});

		test("throws on non-array response", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: JSON.stringify({ notAnArray: true }),
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { listItems } = await import(`./client.js?t=${Date.now()}`);

			expect(() => listItems("session")).toThrow("not an array");
		});

		test("throws on invalid JSON", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "not json",
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { listItems } = await import(`./client.js?t=${Date.now()}`);

			expect(() => listItems("session")).toThrow("Failed to parse vault items");
		});
	});

	describe("getTotp", () => {
		test("returns TOTP code on success", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "123456\n",
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { getTotp } = await import(`./client.js?t=${Date.now()}`);
			const result = getTotp("item-id-123", "session");

			expect(result).toBe("123456");
		});

		test("returns null on failure", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "No TOTP configured",
				status: 1,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { getTotp } = await import(`./client.js?t=${Date.now()}`);
			const result = getTotp("item-without-totp", "session");

			expect(result).toBeNull();
		});
	});

	describe("checkBwInstalled", () => {
		test("returns true when bw is installed", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "2024.1.0",
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { checkBwInstalled } = await import(`./client.js?t=${Date.now()}`);

			expect(checkBwInstalled()).toBe(true);
		});

		test("returns false when bw is not installed", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "command not found: bw",
				status: 127,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { checkBwInstalled } = await import(`./client.js?t=${Date.now()}`);

			expect(checkBwInstalled()).toBe(false);
		});
	});

	describe("lockVault", () => {
		test("returns success on exit code 0", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { lockVault } = await import(`./client.js?t=${Date.now()}`);
			const result = lockVault("session123");

			expect(result.success).toBe(true);
			expect(result.error).toBeUndefined();
		});

		test("returns failure on non-zero exit code", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "Session expired",
				status: 1,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { lockVault } = await import(`./client.js?t=${Date.now()}`);
			const result = lockVault("bad-session");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Session expired");
		});

		test("handles undefined session", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { lockVault } = await import(`./client.js?t=${Date.now()}`);
			const result = lockVault(undefined);

			expect(result.success).toBe(true);
		});

		test("returns generic error when stderr is empty", async () => {
			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "",
				status: 1,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { lockVault } = await import(`./client.js?t=${Date.now()}`);
			const result = lockVault("session");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Failed to lock vault");
		});
	});
});
