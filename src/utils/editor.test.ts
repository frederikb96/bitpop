import { describe, expect, test } from "bun:test";
import { existsSync, statSync } from "node:fs";
import { getEditor, getSecureTempDir } from "./editor.js";

describe("getSecureTempDir", () => {
	test("returns a valid directory path", () => {
		const dir = getSecureTempDir();
		expect(typeof dir).toBe("string");
		expect(dir.length).toBeGreaterThan(0);
	});

	test("directory exists or can be created", () => {
		const dir = getSecureTempDir();
		expect(existsSync(dir)).toBe(true);
	});

	test("directory has restricted permissions", () => {
		const dir = getSecureTempDir();
		const stats = statSync(dir);
		// Check that group and others don't have write/read (owner-only)
		const mode = stats.mode & 0o777;
		expect(mode & 0o077).toBe(0); // No permissions for group/others
	});
});

describe("getEditor", () => {
	test("returns a string", () => {
		const editor = getEditor();
		expect(typeof editor).toBe("string");
		expect(editor.length).toBeGreaterThan(0);
	});

	test("defaults to nano if no env vars set", () => {
		const originalEditor = process.env.EDITOR;
		const originalVisual = process.env.VISUAL;

		process.env.EDITOR = undefined;
		process.env.VISUAL = undefined;

		const editor = getEditor();
		expect(editor).toBe("nano");

		// Restore
		if (originalEditor) process.env.EDITOR = originalEditor;
		if (originalVisual) process.env.VISUAL = originalVisual;
	});

	test("prefers EDITOR over VISUAL", () => {
		const originalEditor = process.env.EDITOR;
		const originalVisual = process.env.VISUAL;

		process.env.EDITOR = "vim";
		process.env.VISUAL = "code";

		const editor = getEditor();
		expect(editor).toBe("vim");

		// Restore
		if (originalEditor) {
			process.env.EDITOR = originalEditor;
		} else {
			process.env.EDITOR = undefined;
		}
		if (originalVisual) {
			process.env.VISUAL = originalVisual;
		} else {
			process.env.VISUAL = undefined;
		}
	});
});
