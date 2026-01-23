import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("clipboard", () => {
	const originalEnv = { ...process.env };
	let mockSpawnSync: ReturnType<typeof mock>;

	beforeEach(() => {
		mockSpawnSync = mock(() => ({
			stdout: "",
			stderr: "",
			status: 0,
		}));
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		mockSpawnSync.mockRestore();
	});

	describe("detectDisplayServer", () => {
		test("returns wayland when WAYLAND_DISPLAY is set", async () => {
			process.env.WAYLAND_DISPLAY = "wayland-0";
			process.env.DISPLAY = undefined;

			// Need to access the internal function - import fresh module
			const clipboardModule = await import(`./clipboard.js?t=${Date.now()}`);

			// detectDisplayServer is not exported, but we can test it through copyToClipboard
			// by checking which command gets called
			mockSpawnSync.mockImplementation((...args: unknown[]) => {
				const cmd = args[0];
				expect(cmd).toBe("wl-copy");
				return { stdout: "", stderr: "", status: 0 };
			});

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { copyToClipboard } = await import(
				`./clipboard.js?t=${Date.now()}`
			);
			copyToClipboard("test");

			expect(mockSpawnSync).toHaveBeenCalled();
		});

		test("returns x11 when DISPLAY is set but not WAYLAND_DISPLAY", async () => {
			process.env.WAYLAND_DISPLAY = undefined;
			process.env.DISPLAY = ":0";

			mockSpawnSync.mockImplementation((...args: unknown[]) => {
				const cmd = args[0];
				expect(cmd).toBe("xclip");
				return { stdout: "", stderr: "", status: 0 };
			});

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { copyToClipboard } = await import(
				`./clipboard.js?t=${Date.now()}`
			);
			copyToClipboard("test");

			expect(mockSpawnSync).toHaveBeenCalled();
		});

		test("returns unknown when neither is set", async () => {
			process.env.WAYLAND_DISPLAY = undefined;
			process.env.DISPLAY = undefined;

			const { copyToClipboard } = await import(
				`./clipboard.js?t=${Date.now()}`
			);
			const result = copyToClipboard("test");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Unknown display server");
		});
	});

	describe("copyToClipboard", () => {
		test("succeeds with wl-copy on Wayland", async () => {
			process.env.WAYLAND_DISPLAY = "wayland-0";
			process.env.DISPLAY = undefined;

			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { copyToClipboard } = await import(
				`./clipboard.js?t=${Date.now()}`
			);
			const result = copyToClipboard("secret password");

			expect(result.success).toBe(true);
			expect(result.error).toBeUndefined();
		});

		test("succeeds with xclip on X11", async () => {
			process.env.WAYLAND_DISPLAY = undefined;
			process.env.DISPLAY = ":0";

			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "",
				status: 0,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { copyToClipboard } = await import(
				`./clipboard.js?t=${Date.now()}`
			);
			const result = copyToClipboard("test text");

			expect(result.success).toBe(true);
		});

		test("returns error when clipboard command fails", async () => {
			process.env.WAYLAND_DISPLAY = "wayland-0";
			process.env.DISPLAY = undefined;

			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "wl-copy: command not found",
				status: 127,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { copyToClipboard } = await import(
				`./clipboard.js?t=${Date.now()}`
			);
			const result = copyToClipboard("text");

			expect(result.success).toBe(false);
			expect(result.error).toBe("wl-copy: command not found");
		});

		test("returns generic error when stderr is empty", async () => {
			process.env.WAYLAND_DISPLAY = "wayland-0";
			process.env.DISPLAY = undefined;

			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "",
				status: 1,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { copyToClipboard } = await import(
				`./clipboard.js?t=${Date.now()}`
			);
			const result = copyToClipboard("text");

			expect(result.success).toBe(false);
			expect(result.error).toBe("wl-copy failed");
		});

		test("returns error for X11 when xclip fails", async () => {
			process.env.WAYLAND_DISPLAY = undefined;
			process.env.DISPLAY = ":0";

			mockSpawnSync.mockImplementation(() => ({
				stdout: "",
				stderr: "",
				status: 1,
			}));

			mock.module("node:child_process", () => ({
				spawnSync: mockSpawnSync,
			}));

			const { copyToClipboard } = await import(
				`./clipboard.js?t=${Date.now()}`
			);
			const result = copyToClipboard("text");

			expect(result.success).toBe(false);
			expect(result.error).toBe("xclip failed");
		});
	});
});
