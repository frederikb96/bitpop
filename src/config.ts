import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface Shortcut {
	key: string;
	search: string;
	description?: string;
}

export interface Config {
	auto_close_hours: number;
	clipboard_clear_seconds: number;
	max_visible_entries: number;
	shortcuts: Shortcut[];
}

const DEFAULT_CONFIG: Config = {
	auto_close_hours: 4,
	clipboard_clear_seconds: 30,
	max_visible_entries: 30,
	shortcuts: [],
};

/**
 * Get config directory path.
 * Priority: BITPOP_CONFIG_DIR env var > auto-detect dev mode > production default
 */
export function getConfigDir(): string {
	// Priority 1: Explicit env var (for dev/testing)
	if (process.env.BITPOP_CONFIG_DIR) {
		return process.env.BITPOP_CONFIG_DIR;
	}

	// Priority 2: Auto-detect dev mode (in bitpop repo with .data-dev/)
	const cwd = process.cwd();
	const devPath = join(cwd, ".data-dev");
	if (existsSync(devPath) && existsSync(join(cwd, "src/cli.ts"))) {
		return devPath;
	}

	// Priority 3: Production default
	return join(homedir(), ".config", "bitpop");
}

export function getConfigPath(): string {
	return join(getConfigDir(), "config.yaml");
}

function ensureConfigDir(): void {
	const dir = getConfigDir();
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

function isValidShortcut(shortcut: unknown): shortcut is Shortcut {
	if (typeof shortcut !== "object" || shortcut === null) return false;
	const s = shortcut as Record<string, unknown>;
	return (
		typeof s.key === "string" &&
		s.key.length > 0 &&
		typeof s.search === "string"
	);
}

function validateConfig(parsed: Partial<Config>): Config {
	const config = { ...DEFAULT_CONFIG, ...parsed };

	if (
		typeof config.auto_close_hours !== "number" ||
		config.auto_close_hours <= 0
	) {
		config.auto_close_hours = DEFAULT_CONFIG.auto_close_hours;
	}

	if (
		typeof config.clipboard_clear_seconds !== "number" ||
		config.clipboard_clear_seconds < 0
	) {
		config.clipboard_clear_seconds = DEFAULT_CONFIG.clipboard_clear_seconds;
	}

	if (
		typeof config.max_visible_entries !== "number" ||
		config.max_visible_entries <= 0
	) {
		config.max_visible_entries = DEFAULT_CONFIG.max_visible_entries;
	}

	if (!Array.isArray(config.shortcuts)) {
		config.shortcuts = DEFAULT_CONFIG.shortcuts;
	} else {
		config.shortcuts = config.shortcuts.filter(isValidShortcut);
	}

	return config;
}

export function loadConfig(): Config {
	ensureConfigDir();
	const configPath = getConfigPath();

	if (!existsSync(configPath)) {
		saveConfig(DEFAULT_CONFIG);
		return DEFAULT_CONFIG;
	}

	const raw = readFileSync(configPath, "utf-8");
	const parsed = parseYaml(raw) as Partial<Config>;

	return validateConfig(parsed);
}

export function saveConfig(config: Config): void {
	ensureConfigDir();
	const configPath = getConfigPath();
	const yaml = stringifyYaml(config);
	writeFileSync(configPath, yaml, "utf-8");
}
