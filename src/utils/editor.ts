import { spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Get secure temp directory for sensitive files.
 * Uses XDG_RUNTIME_DIR (user-only tmpfs) or falls back to ~/.cache/bitpop
 */
export function getSecureTempDir(): string {
	// XDG_RUNTIME_DIR is user-only and typically tmpfs (RAM-based)
	const xdgRuntime = process.env.XDG_RUNTIME_DIR;
	if (xdgRuntime && existsSync(xdgRuntime)) {
		const bitpopDir = join(xdgRuntime, "bitpop");
		if (!existsSync(bitpopDir)) {
			mkdirSync(bitpopDir, { mode: 0o700 });
		}
		return bitpopDir;
	}

	// Fallback to ~/.cache/bitpop with restricted permissions
	const cacheDir = join(homedir(), ".cache", "bitpop");
	if (!existsSync(cacheDir)) {
		mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
	}
	return cacheDir;
}

/**
 * Get the user's preferred editor.
 */
export function getEditor(): string {
	return process.env.EDITOR || process.env.VISUAL || "nano";
}

export interface EditorResult {
	success: boolean;
	content?: string;
	cancelled?: boolean;
	error?: string;
}

/**
 * Open content in the user's editor and return the edited result.
 * Creates a secure temp file, spawns the editor, and reads back the content.
 *
 * @param content Initial content to edit
 * @param filename Filename hint (e.g., "new-login.yaml")
 * @returns Result with edited content or cancellation/error status
 */
export function openInEditor(content: string, filename: string): EditorResult {
	const tempDir = getSecureTempDir();
	const timestamp = Date.now();
	const tempFile = join(tempDir, `${timestamp}-${filename}`);

	try {
		// Write content with restricted permissions (owner read/write only)
		writeFileSync(tempFile, content, { mode: 0o600 });
		chmodSync(tempFile, 0o600);

		const editor = getEditor();

		// Spawn editor with TTY inheritance
		const result = spawnSync(editor, [tempFile], {
			stdio: "inherit",
			shell: true,
		});

		if (result.status !== 0) {
			// Editor exited with error
			cleanupTempFile(tempFile);
			return {
				success: false,
				error: `Editor exited with code ${result.status}`,
			};
		}

		// Read edited content
		const editedContent = readFileSync(tempFile, "utf-8");
		cleanupTempFile(tempFile);

		// Check if user cleared content (cancellation signal)
		const trimmed = editedContent.trim();
		if (trimmed === "" || trimmed.startsWith("# CANCEL")) {
			return { success: true, cancelled: true };
		}

		return { success: true, content: editedContent };
	} catch (err) {
		cleanupTempFile(tempFile);
		return {
			success: false,
			error: err instanceof Error ? err.message : "Unknown error",
		};
	}
}

function cleanupTempFile(path: string): void {
	try {
		if (existsSync(path)) {
			unlinkSync(path);
		}
	} catch {
		// Ignore cleanup errors
	}
}
