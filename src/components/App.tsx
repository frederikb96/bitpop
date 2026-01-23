import { Box, Text, useApp, useInput } from "ink";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	type BwItem,
	checkBwInstalled,
	getBwStatus,
	listItems,
	lockVault,
	syncVault,
	unlockVault,
} from "../bw/client.js";
import { type Config, type Shortcut, loadConfig } from "../config.js";
import { useSearch } from "../hooks/useSearch.js";
import { copyToClipboard, scheduleClipboardClear } from "../utils/clipboard.js";
import { generateTotp } from "../utils/totp.js";
import { DetailView } from "./DetailView.js";
import { PasswordPrompt } from "./PasswordPrompt.js";
import { ResultsList } from "./ResultsList.js";
import { SearchInput } from "./SearchInput.js";
import { ShortcutMode } from "./ShortcutMode.js";

type AppMode =
	| "password"
	| "loading"
	| "search"
	| "detail"
	| "shortcut"
	| "error";

interface AppState {
	mode: AppMode;
	session: string | null;
	items: BwItem[];
	selectedIndex: number;
	selectedItem: BwItem | null;
	error: string | null;
	config: Config;
	message: string | null;
}

export function App() {
	const { exit } = useApp();
	const [state, setState] = useState<AppState>(() => ({
		mode: "password",
		session: null,
		items: [],
		selectedIndex: 0,
		selectedItem: null,
		error: null,
		config: loadConfig(),
		message: null,
	}));

	const { query, setQuery, results } = useSearch(state.items);

	// Reset selection to top when query changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: query is intentionally in deps to trigger reset on search
	useEffect(() => {
		setState((s) => ({ ...s, selectedIndex: 0 }));
	}, [query]);

	// Ref to track session for cleanup without causing effect re-runs
	const sessionRef = useRef<string | null>(null);
	useEffect(() => {
		sessionRef.current = state.session;
	}, [state.session]);

	// Ref to track message display timer to prevent race conditions
	const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const showMessage = useCallback((message: string) => {
		if (messageTimerRef.current) {
			clearTimeout(messageTimerRef.current);
		}
		setState((s) => ({ ...s, message }));
		messageTimerRef.current = setTimeout(() => {
			setState((s) => ({ ...s, message: null }));
			messageTimerRef.current = null;
		}, 2000);
	}, []);

	// Clear timer on unmount
	useEffect(() => {
		return () => {
			if (messageTimerRef.current) {
				clearTimeout(messageTimerRef.current);
			}
		};
	}, []);

	// Graceful shutdown - lock vault on exit, returns true if lock succeeded
	const cleanup = useCallback((): boolean => {
		if (sessionRef.current) {
			const result = lockVault(sessionRef.current);
			return result.success;
		}
		return true;
	}, []);

	// Setup signal handlers and auto-close timeout
	useEffect(() => {
		// Signal handlers for graceful shutdown
		const handleSignal = () => {
			cleanup();
			process.exit(0);
		};

		process.on("SIGINT", handleSignal);
		process.on("SIGTERM", handleSignal);
		process.on("SIGHUP", handleSignal);

		// Auto-close timeout
		const timeoutMs = state.config.auto_close_hours * 60 * 60 * 1000;
		const autoCloseTimer = setTimeout(() => {
			cleanup();
			exit();
		}, timeoutMs);

		return () => {
			process.off("SIGINT", handleSignal);
			process.off("SIGTERM", handleSignal);
			process.off("SIGHUP", handleSignal);
			clearTimeout(autoCloseTimer);
		};
	}, [cleanup, exit, state.config.auto_close_hours]);

	// Check BW status on mount
	useEffect(() => {
		if (!checkBwInstalled()) {
			setState((s) => ({
				...s,
				mode: "error",
				error: "Bitwarden CLI (bw) not found. Please install it first.",
			}));
			return;
		}

		const status = getBwStatus();
		if (status.status === "unauthenticated") {
			setState((s) => ({
				...s,
				mode: "error",
				error: 'Not logged in to Bitwarden. Run "bw login" first.',
			}));
		}
	}, []);

	// Handle password submission
	const handlePasswordSubmit = useCallback(async (password: string) => {
		setState((s) => ({ ...s, mode: "loading", error: null }));

		const result = unlockVault(password);
		if (!result.success || !result.session) {
			setState((s) => ({
				...s,
				mode: "password",
				error: result.error ?? "Failed to unlock vault",
			}));
			return;
		}

		const session = result.session;

		// Fetch items
		try {
			const items = listItems(session);
			setState((s) => ({
				...s,
				mode: "search",
				session,
				items,
				error: null,
			}));
		} catch (err) {
			lockVault(session);
			setState((s) => ({
				...s,
				mode: "error",
				error: `Failed to fetch items: ${err}`,
			}));
		}
	}, []);

	// Copy field to clipboard
	const copyField = useCallback(
		(field: "username" | "password" | "totp") => {
			const item = state.selectedItem ?? results[state.selectedIndex]?.item;
			if (!item || !state.session) return;

			let value: string | null = null;
			let fieldName = "";

			switch (field) {
				case "username":
					value =
						item.login?.username ??
						item.identity?.email ??
						item.card?.cardholderName ??
						null;
					fieldName = "Username";
					break;
				case "password":
					value = item.login?.password ?? item.card?.number ?? null;
					fieldName = "Password";
					break;
				case "totp":
					if (item.login?.totp) {
						value = generateTotp(item.login.totp);
					}
					fieldName = "TOTP";
					break;
			}

			if (!value) {
				showMessage(`No ${fieldName} available`);
				return;
			}

			const result = copyToClipboard(value);
			if (result.success) {
				showMessage(`${fieldName} copied!`);
				scheduleClipboardClear(state.config.clipboard_clear_seconds);
			} else {
				showMessage(`Copy failed: ${result.error}`);
			}
		},
		[
			state.selectedItem,
			state.selectedIndex,
			state.session,
			state.config.clipboard_clear_seconds,
			results,
			showMessage,
		],
	);

	// Handle shortcut selection
	const handleShortcut = useCallback(
		(shortcut: Shortcut) => {
			setQuery(shortcut.search);
			setState((s) => ({ ...s, mode: "search", selectedIndex: 0 }));
		},
		[setQuery],
	);

	// Keyboard input handling
	useInput((input, key) => {
		// Global: Ctrl+D or Ctrl+C to quit
		if ((key.ctrl && input === "d") || (key.ctrl && input === "c")) {
			cleanup();
			exit();
			return;
		}

		// Password mode - handled by PasswordPrompt
		if (
			state.mode === "password" ||
			state.mode === "loading" ||
			state.mode === "error"
		) {
			return;
		}

		// Escape to go back / close
		if (key.escape) {
			if (state.mode === "detail") {
				setState((s) => ({ ...s, mode: "search", selectedItem: null }));
			} else if (state.mode === "shortcut") {
				setState((s) => ({ ...s, mode: "search" }));
			} else {
				cleanup();
				exit();
			}
			return;
		}

		// Shortcut mode
		if (state.mode === "shortcut") {
			const shortcut = state.config.shortcuts.find(
				(s) => s.key.toLowerCase() === input.toLowerCase(),
			);
			if (shortcut) {
				handleShortcut(shortcut);
			}
			return;
		}

		// Search and detail modes - copy shortcuts use Ctrl modifier
		if (state.mode === "search" || state.mode === "detail") {
			if (key.ctrl && input === "u") {
				copyField("username");
				return;
			}
			if (key.ctrl && input === "p") {
				copyField("password");
				return;
			}
			if (key.ctrl && input === "t") {
				copyField("totp");
				return;
			}
			// Ctrl+X clears search
			if (key.ctrl && input === "x") {
				setQuery("");
				return;
			}
			// Ctrl+R syncs and refreshes items
			if (key.ctrl && input === "r") {
				if (!state.session) return;
				showMessage("Syncing...");
				const syncResult = syncVault(state.session);
				if (!syncResult.success) {
					showMessage(`Sync failed: ${syncResult.error}`);
					return;
				}
				try {
					const items = listItems(state.session);
					setState((s) => ({ ...s, items }));
					showMessage(`Synced! ${items.length} items loaded`);
				} catch (err) {
					showMessage(`Refresh failed: ${err}`);
				}
				return;
			}
		}

		// Search mode specific
		if (state.mode === "search") {
			// Ctrl+S enters shortcut mode (works even with search text)
			if (key.ctrl && input === "s") {
				setState((s) => ({ ...s, mode: "shortcut" }));
				return;
			}

			// Number keys 1-9, 0 for direct selection (relative to visible window)
			const maxVisible = state.config.max_visible_entries;
			const scrollOffset = Math.max(
				0,
				state.selectedIndex - Math.floor(maxVisible / 2),
			);

			// Alt+1-9, Alt+0 for direct selection (relative to visible window)
			if (key.meta && /^[1-9]$/.test(input)) {
				const visibleIdx = Number.parseInt(input) - 1;
				const actualIdx = scrollOffset + visibleIdx;
				if (actualIdx < results.length) {
					setState((s) => ({
						...s,
						selectedIndex: actualIdx,
						selectedItem: results[actualIdx].item,
						mode: "detail",
					}));
				}
				return;
			}
			if (key.meta && input === "0") {
				const actualIdx = scrollOffset + 9;
				if (actualIdx < results.length) {
					setState((s) => ({
						...s,
						selectedIndex: actualIdx,
						selectedItem: results[actualIdx].item,
						mode: "detail",
					}));
				}
				return;
			}

			// Arrow navigation
			if (key.upArrow) {
				setState((s) => ({
					...s,
					selectedIndex: Math.max(0, s.selectedIndex - 1),
				}));
				return;
			}
			if (key.downArrow) {
				setState((s) => ({
					...s,
					selectedIndex: Math.max(
						0,
						Math.min(results.length - 1, s.selectedIndex + 1),
					),
				}));
				return;
			}

			// Page Up/Down - move by half visible entries
			const pageStep = Math.floor(state.config.max_visible_entries / 2);
			if (key.pageUp) {
				setState((s) => ({
					...s,
					selectedIndex: Math.max(0, s.selectedIndex - pageStep),
				}));
				return;
			}
			if (key.pageDown) {
				setState((s) => ({
					...s,
					selectedIndex: Math.min(
						results.length - 1,
						s.selectedIndex + pageStep,
					),
				}));
				return;
			}

			// Enter to view detail
			if (key.return && results.length > 0) {
				setState((s) => ({
					...s,
					mode: "detail",
					selectedItem: results[s.selectedIndex].item,
				}));
				return;
			}
		}
	});

	// Render based on mode
	if (state.mode === "error") {
		return (
			<Box padding={1}>
				<Text color="red">{state.error}</Text>
			</Box>
		);
	}

	if (state.mode === "password") {
		return (
			<PasswordPrompt
				onSubmit={handlePasswordSubmit}
				error={state.error ?? undefined}
			/>
		);
	}

	if (state.mode === "loading") {
		return (
			<Box padding={1}>
				<Text color="blue">Unlocking vault...</Text>
			</Box>
		);
	}

	if (state.mode === "shortcut") {
		return <ShortcutMode shortcuts={state.config.shortcuts} />;
	}

	if (state.mode === "detail" && state.selectedItem) {
		return (
			<Box flexDirection="column">
				<DetailView item={state.selectedItem} />
				{state.message && (
					<Box paddingX={1}>
						<Text color="green">{state.message}</Text>
					</Box>
				)}
			</Box>
		);
	}

	// Search mode (default)
	// Calculate scroll offset for visible window
	const maxVisible = state.config.max_visible_entries;
	const scrollOffset = Math.max(
		0,
		state.selectedIndex - Math.floor(maxVisible / 2),
	);

	return (
		<Box flexDirection="column" padding={1}>
			<SearchInput value={query} onChange={setQuery} />
			<ResultsList
				results={results}
				selectedIndex={state.selectedIndex}
				maxVisible={maxVisible}
				scrollOffset={scrollOffset}
			/>
			{state.message && (
				<Box marginTop={1}>
					<Text color="green">{state.message}</Text>
				</Box>
			)}
			<Box marginTop={1}>
				<Text color="gray">
					[↑↓/PgUp/Dn] navigate [Alt+1-9] jump [Enter] detail [Ctrl+S] shortcuts
					[Ctrl+U]ser [Ctrl+P]ass [Ctrl+T]OTP [Ctrl+R] sync [Ctrl+X] clear [Esc]
					quit
				</Text>
			</Box>
		</Box>
	);
}
