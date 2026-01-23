import { spawnSync } from "node:child_process";

type DisplayServer = "wayland" | "x11" | "unknown";

function detectDisplayServer(): DisplayServer {
	if (process.env.WAYLAND_DISPLAY) {
		return "wayland";
	}
	if (process.env.DISPLAY) {
		return "x11";
	}
	return "unknown";
}

export function copyToClipboard(text: string): {
	success: boolean;
	error?: string;
} {
	const server = detectDisplayServer();

	let cmd: string;
	let args: string[];

	switch (server) {
		case "wayland":
			cmd = "wl-copy";
			args = [];
			break;
		case "x11":
			cmd = "xclip";
			args = ["-selection", "clipboard"];
			break;
		default:
			return { success: false, error: "Unknown display server" };
	}

	const result = spawnSync(cmd, args, {
		input: text,
		encoding: "utf-8",
		timeout: 5000,
	});

	if (result.status !== 0) {
		return { success: false, error: result.stderr || `${cmd} failed` };
	}

	return { success: true };
}

export function clearClipboard(): { success: boolean; error?: string } {
	return copyToClipboard("");
}

let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleClipboardClear(seconds: number): void {
	if (clipboardClearTimer) {
		clearTimeout(clipboardClearTimer);
	}
	if (seconds > 0) {
		clipboardClearTimer = setTimeout(() => {
			clearClipboard();
			clipboardClearTimer = null;
		}, seconds * 1000);
	}
}

export function cancelClipboardClear(): void {
	if (clipboardClearTimer) {
		clearTimeout(clipboardClearTimer);
		clipboardClearTimer = null;
	}
}
