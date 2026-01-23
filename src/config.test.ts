import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Test data
const VALID_CONFIG_YAML = `auto_close_hours: 8
shortcuts:
  - key: "g"
    search: "github"
    description: "GitHub accounts"
`;

const PARTIAL_CONFIG_YAML = `shortcuts:
  - key: "a"
    search: "aws"
`;

describe("config", () => {
	const originalEnv = { ...process.env };
	let tempDir: string;

	beforeEach(() => {
		// Create a unique temp dir for each test
		tempDir = `/tmp/bitpop-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	});

	afterEach(() => {
		// Restore env
		process.env = { ...originalEnv };

		// Clean up temp dir if it exists
		try {
			const fs = require("node:fs");
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("getConfigDir", () => {
		test("returns BITPOP_CONFIG_DIR when set", async () => {
			process.env.BITPOP_CONFIG_DIR = "/custom/config/path";

			// Dynamic import to pick up env changes
			const { getConfigDir } = await import("./config.js");

			expect(getConfigDir()).toBe("/custom/config/path");
		});

		test("returns production default when no env var and not in dev mode", async () => {
			process.env.BITPOP_CONFIG_DIR = undefined;

			// Change to a directory that's definitely not the bitpop repo
			const originalCwd = process.cwd();
			const mockCwd = mock(() => "/tmp/not-bitpop");
			const realCwd = process.cwd;
			process.cwd = mockCwd;

			try {
				// Force fresh import
				const configModule = await import(`./config.js?t=${Date.now()}`);

				// Since cwd mock and fs don't match, it should fall back to production
				const result = configModule.getConfigDir();
				expect(result).toBe(join(homedir(), ".config", "bitpop"));
			} finally {
				process.cwd = realCwd;
			}
		});
	});

	describe("loadConfig", () => {
		test("creates default config when none exists", async () => {
			process.env.BITPOP_CONFIG_DIR = tempDir;

			const { loadConfig, getConfigPath } = await import(
				`./config.js?t=${Date.now()}`
			);
			const config = loadConfig();

			// Should return defaults
			expect(config.auto_close_hours).toBe(4);
			expect(config.shortcuts).toEqual([]);

			// Should have created the file
			const fs = require("node:fs");
			expect(fs.existsSync(getConfigPath())).toBe(true);
		});

		test("loads valid config from file", async () => {
			process.env.BITPOP_CONFIG_DIR = tempDir;

			// Pre-create config
			const fs = require("node:fs");
			fs.mkdirSync(tempDir, { recursive: true });
			fs.writeFileSync(join(tempDir, "config.yaml"), VALID_CONFIG_YAML);

			const { loadConfig } = await import(`./config.js?t=${Date.now()}`);
			const config = loadConfig();

			expect(config.auto_close_hours).toBe(8);
			expect(config.shortcuts).toHaveLength(1);
			expect(config.shortcuts[0].key).toBe("g");
			expect(config.shortcuts[0].search).toBe("github");
		});

		test("merges partial config with defaults", async () => {
			process.env.BITPOP_CONFIG_DIR = tempDir;

			// Pre-create partial config (missing auto_close_hours)
			const fs = require("node:fs");
			fs.mkdirSync(tempDir, { recursive: true });
			fs.writeFileSync(join(tempDir, "config.yaml"), PARTIAL_CONFIG_YAML);

			const { loadConfig } = await import(`./config.js?t=${Date.now()}`);
			const config = loadConfig();

			// Should have default auto_close_hours
			expect(config.auto_close_hours).toBe(4);
			// But custom shortcuts
			expect(config.shortcuts).toHaveLength(1);
			expect(config.shortcuts[0].key).toBe("a");
		});
	});

	describe("saveConfig", () => {
		test("saves config to yaml file", async () => {
			process.env.BITPOP_CONFIG_DIR = tempDir;

			const { saveConfig, getConfigPath } = await import(
				`./config.js?t=${Date.now()}`
			);

			const config = {
				auto_close_hours: 12,
				shortcuts: [{ key: "t", search: "test" }],
			};

			saveConfig(config);

			// Read back and verify
			const fs = require("node:fs");
			const content = fs.readFileSync(getConfigPath(), "utf-8");
			expect(content).toContain("auto_close_hours: 12");
			expect(content).toContain("key: t");
			expect(content).toContain("search: test");
		});

		test("creates directory if it does not exist", async () => {
			const nestedDir = join(tempDir, "nested", "path");
			process.env.BITPOP_CONFIG_DIR = nestedDir;

			const { saveConfig } = await import(`./config.js?t=${Date.now()}`);

			saveConfig({ auto_close_hours: 1, shortcuts: [] });

			const fs = require("node:fs");
			expect(fs.existsSync(nestedDir)).toBe(true);
		});
	});
});
