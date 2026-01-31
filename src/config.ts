import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface Shortcut {
	key: string;
	search: string;
	description?: string;
}

export interface PasswordGenerationConfig {
	type: "random" | "passphrase";
	// Random password options
	length: number;
	uppercase: boolean;
	lowercase: boolean;
	number: boolean;
	special: boolean;
	// Passphrase options
	words: number;
	separator: string;
	capitalize: boolean;
	includeNumber: boolean;
}

export interface Config {
	auto_close_hours: number;
	clipboard_clear_seconds: number;
	max_visible_entries: number;
	totp_expiry_warning_seconds: number;
	shortcuts: Shortcut[];
	password_generation: PasswordGenerationConfig;
}

const DEFAULT_PASSWORD_GENERATION: PasswordGenerationConfig = {
	type: "passphrase",
	length: 16,
	uppercase: true,
	lowercase: true,
	number: true,
	special: true,
	words: 5,
	separator: "-",
	capitalize: true,
	includeNumber: true,
};

const DEFAULT_CONFIG: Config = {
	auto_close_hours: 4,
	clipboard_clear_seconds: 30,
	max_visible_entries: 30,
	totp_expiry_warning_seconds: 5,
	shortcuts: [],
	password_generation: DEFAULT_PASSWORD_GENERATION,
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

function validatePasswordGeneration(
	pg: Partial<PasswordGenerationConfig> | undefined,
): PasswordGenerationConfig {
	const defaults = DEFAULT_PASSWORD_GENERATION;
	if (!pg || typeof pg !== "object") return defaults;

	return {
		type: pg.type === "random" ? "random" : "passphrase",
		length:
			typeof pg.length === "number" && pg.length >= 5
				? pg.length
				: defaults.length,
		uppercase:
			typeof pg.uppercase === "boolean" ? pg.uppercase : defaults.uppercase,
		lowercase:
			typeof pg.lowercase === "boolean" ? pg.lowercase : defaults.lowercase,
		number: typeof pg.number === "boolean" ? pg.number : defaults.number,
		special: typeof pg.special === "boolean" ? pg.special : defaults.special,
		words:
			typeof pg.words === "number" && pg.words >= 3 ? pg.words : defaults.words,
		separator:
			typeof pg.separator === "string" ? pg.separator : defaults.separator,
		capitalize:
			typeof pg.capitalize === "boolean" ? pg.capitalize : defaults.capitalize,
		includeNumber:
			typeof pg.includeNumber === "boolean"
				? pg.includeNumber
				: defaults.includeNumber,
	};
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

	if (
		typeof config.totp_expiry_warning_seconds !== "number" ||
		config.totp_expiry_warning_seconds < 0
	) {
		config.totp_expiry_warning_seconds =
			DEFAULT_CONFIG.totp_expiry_warning_seconds;
	}

	if (!Array.isArray(config.shortcuts)) {
		config.shortcuts = DEFAULT_CONFIG.shortcuts;
	} else {
		config.shortcuts = config.shortcuts.filter(isValidShortcut);
	}

	config.password_generation = validatePasswordGeneration(
		parsed.password_generation,
	);

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

	// Handle corrupt config gracefully - fall back to defaults
	let parsed: Partial<Config>;
	try {
		parsed = parseYaml(raw) as Partial<Config>;
	} catch {
		return DEFAULT_CONFIG;
	}

	return validateConfig(parsed);
}

export function saveConfig(config: Config): void {
	ensureConfigDir();
	const configPath = getConfigPath();
	const yaml = stringifyYaml(config);
	writeFileSync(configPath, yaml, { encoding: "utf-8", mode: 0o600 });
}
