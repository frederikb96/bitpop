import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { BwField, BwItem, BwLogin, BwUri } from "../bw/client.js";

/**
 * YAML representation of a login item for human editing.
 */
export interface LoginYaml {
	name: string;
	username?: string;
	password?: string;
	url?: string;
	totp_secret?: string;
	notes?: string;
	favorite?: boolean;
	reprompt?: boolean;
	additional_urls?: string[];
	custom_fields?: CustomFieldYaml[];
}

export interface CustomFieldYaml {
	name: string;
	value: string;
	hidden?: boolean;
}

/**
 * Escape a string value for safe YAML output.
 * Handles quotes, newlines, and backslashes.
 */
function escapeYamlValue(value: string): string {
	// If value contains special characters, escape them
	const escaped = value
		.replace(/\\/g, "\\\\") // Backslashes first
		.replace(/"/g, '\\"') // Quotes
		.replace(/\n/g, "\\n") // Newlines
		.replace(/\r/g, "\\r") // Carriage returns
		.replace(/\t/g, "\\t"); // Tabs
	return `"${escaped}"`;
}

const CREATE_TEMPLATE = `# Bitpop - New Login
# Save and close to create. Delete all content to cancel.

name: ""                    # Required - entry name
username: ""
password: ""                # Leave empty for no password
url: ""                     # Primary URL
totp_secret: ""             # TOTP/2FA secret (otpauth:// or base32)

# Optional settings
notes: ""
favorite: false
reprompt: false             # Require master password to view

# Additional URLs (optional)
# additional_urls:
#   - "https://app.example.com"
#   - "https://api.example.com"

# Custom fields (optional)
# custom_fields:
#   - name: "API Key"
#     value: "your-key-here"
#     hidden: true
#   - name: "Account ID"
#     value: "12345"
`;

/**
 * Generate YAML template for creating a new login.
 */
export function getCreateTemplate(): string {
	return CREATE_TEMPLATE;
}

/**
 * Convert a BwItem to YAML for editing.
 * Shows commented-out sections for fields not currently set,
 * so users know the available options.
 */
export function itemToYaml(item: BwItem): string {
	const login = item.login ?? {};
	const lines: string[] = [];

	lines.push(`# Bitpop - Edit Login: ${item.name}`);
	lines.push("# Save and close to update. Delete all content to cancel.");
	lines.push("");

	// Required field
	lines.push(`name: ${escapeYamlValue(item.name)}`);

	// Basic login fields
	if (login.username) {
		lines.push(`username: ${escapeYamlValue(login.username)}`);
	} else {
		lines.push('# username: ""');
	}

	if (login.password) {
		lines.push(`password: ${escapeYamlValue(login.password)}`);
	} else {
		lines.push('# password: ""');
	}

	if (login.uris?.[0]?.uri) {
		lines.push(`url: ${escapeYamlValue(login.uris[0].uri)}`);
	} else {
		lines.push('# url: ""');
	}

	if (login.totp) {
		lines.push(`totp_secret: ${escapeYamlValue(login.totp)}`);
	} else {
		lines.push('# totp_secret: ""');
	}

	// Notes - handle multiline
	if (item.notes) {
		if (item.notes.includes("\n")) {
			lines.push("notes: |");
			for (const noteLine of item.notes.split("\n")) {
				lines.push(`  ${noteLine}`);
			}
		} else {
			lines.push(`notes: ${escapeYamlValue(item.notes)}`);
		}
	} else {
		lines.push('# notes: ""');
	}

	// Boolean fields
	lines.push(`favorite: ${item.favorite ?? false}`);
	lines.push(`reprompt: ${item.reprompt === 1}`);

	// Additional URLs
	if (login.uris && login.uris.length > 1) {
		lines.push("additional_urls:");
		for (const u of login.uris.slice(1)) {
			lines.push(`  - ${escapeYamlValue(u.uri)}`);
		}
	} else {
		lines.push("# additional_urls:");
		lines.push('#   - "https://app.example.com"');
	}

	// Custom fields
	if (item.fields && item.fields.length > 0) {
		lines.push("custom_fields:");
		for (const f of item.fields) {
			lines.push(`  - name: ${escapeYamlValue(f.name)}`);
			lines.push(`    value: ${escapeYamlValue(f.value ?? "")}`);
			if (f.type === 1) {
				lines.push("    hidden: true");
			}
		}
	} else {
		lines.push("# custom_fields:");
		lines.push('#   - name: "API Key"');
		lines.push('#     value: "your-key-here"');
		lines.push("#     hidden: true");
	}

	return `${lines.join("\n")}\n`;
}

/**
 * Parse YAML into a partial BwItem structure for create/edit.
 * Returns null if YAML is empty or invalid.
 */
export function yamlToItem(yamlContent: string): Partial<BwItem> | null {
	// Remove comment lines for parsing check
	const contentLines = yamlContent
		.split("\n")
		.filter((line) => !line.trim().startsWith("#"));
	const strippedContent = contentLines.join("\n").trim();

	if (!strippedContent) {
		return null;
	}

	let parsed: LoginYaml;
	try {
		parsed = parseYaml(yamlContent) as LoginYaml;
	} catch {
		return null;
	}

	if (!parsed || typeof parsed !== "object") {
		return null;
	}

	// Name is required
	if (!parsed.name || typeof parsed.name !== "string" || !parsed.name.trim()) {
		return null;
	}

	// Build URIs array
	const uris: BwUri[] = [];
	if (parsed.url && typeof parsed.url === "string" && parsed.url.trim()) {
		uris.push({ uri: parsed.url.trim() });
	}
	if (Array.isArray(parsed.additional_urls)) {
		for (const url of parsed.additional_urls) {
			if (typeof url === "string" && url.trim()) {
				uris.push({ uri: url.trim() });
			}
		}
	}

	// Build login object - always include all fields for proper replacement
	// Use empty string for cleared fields (BW CLI interprets empty as "clear")
	const login: BwLogin = {
		username:
			parsed.username && typeof parsed.username === "string"
				? parsed.username
				: "",
		password:
			parsed.password && typeof parsed.password === "string"
				? parsed.password
				: "",
		totp:
			parsed.totp_secret && typeof parsed.totp_secret === "string"
				? parsed.totp_secret
				: "",
		uris: uris.length > 0 ? uris : [],
	};

	// Build item - always include all fields to ensure BW CLI replaces them
	const item: Partial<BwItem> = {
		type: 1, // Login
		name: parsed.name.trim(),
		login,
		favorite: parsed.favorite === true,
		reprompt: parsed.reprompt === true ? 1 : 0,
		// Always include notes (empty string clears it)
		notes:
			parsed.notes && typeof parsed.notes === "string" && parsed.notes.trim()
				? parsed.notes.trim()
				: "",
		// Always include fields (empty array clears them)
		fields: [],
	};

	// Custom fields - populate if present
	if (Array.isArray(parsed.custom_fields) && parsed.custom_fields.length > 0) {
		item.fields = parsed.custom_fields
			.filter(
				(f): f is CustomFieldYaml =>
					typeof f === "object" &&
					f !== null &&
					typeof f.name === "string" &&
					f.name.trim() !== "",
			)
			.map((f) => ({
				name: f.name.trim(),
				value: typeof f.value === "string" ? f.value : "",
				type: f.hidden === true ? 1 : 0,
			}));
	}

	return item;
}

/**
 * Validate parsed YAML item for creation.
 * Returns error message or null if valid.
 */
export function validateItem(item: Partial<BwItem>): string | null {
	if (!item.name || !item.name.trim()) {
		return "Name is required";
	}
	return null;
}

/**
 * Check if two items are effectively the same (no changes needed).
 * Compares the fields that matter for editing.
 */
export function itemsEqual(original: BwItem, edited: Partial<BwItem>): boolean {
	// Compare name
	if (original.name !== edited.name) return false;

	// Compare favorite and reprompt
	if ((original.favorite ?? false) !== (edited.favorite ?? false)) return false;
	if ((original.reprompt ?? 0) !== (edited.reprompt ?? 0)) return false;

	// Compare notes
	const origNotes = original.notes ?? "";
	const editNotes = edited.notes ?? "";
	if (origNotes !== editNotes) return false;

	// Compare login fields
	const origLogin = original.login ?? {};
	const editLogin = edited.login ?? {};
	if ((origLogin.username ?? "") !== (editLogin.username ?? "")) return false;
	if ((origLogin.password ?? "") !== (editLogin.password ?? "")) return false;
	if ((origLogin.totp ?? "") !== (editLogin.totp ?? "")) return false;

	// Compare URIs
	const origUris = origLogin.uris ?? [];
	const editUris = editLogin.uris ?? [];
	if (origUris.length !== editUris.length) return false;
	for (let i = 0; i < origUris.length; i++) {
		if (origUris[i].uri !== editUris[i].uri) return false;
	}

	// Compare custom fields
	const origFields = original.fields ?? [];
	const editFields = edited.fields ?? [];
	if (origFields.length !== editFields.length) return false;
	for (let i = 0; i < origFields.length; i++) {
		if (origFields[i].name !== editFields[i].name) return false;
		if ((origFields[i].value ?? "") !== (editFields[i].value ?? ""))
			return false;
		if (origFields[i].type !== editFields[i].type) return false;
	}

	return true;
}
