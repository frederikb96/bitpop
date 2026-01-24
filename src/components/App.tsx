import { spawnSync } from "node:child_process";
import { Box, Text, useApp, useInput } from "ink";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	type BwItem,
	CipherType,
	checkBwInstalled,
	createItem,
	deleteItem,
	editItem,
	getBwStatus,
	listItems,
	lockVault,
	syncVault,
	unlockVault,
} from "../bw/client.js";
import {
	type Config,
	type Shortcut,
	getConfigPath,
	loadConfig,
} from "../config.js";
import { useSearch } from "../hooks/useSearch.js";
import { copyToClipboard, scheduleClipboardClear } from "../utils/clipboard.js";
import { getEditor, openInEditor } from "../utils/editor.js";
import { generateTotp } from "../utils/totp.js";
import {
	getCreateTemplate,
	itemToYaml,
	itemsEqual,
	yamlToItem,
} from "../utils/yaml.js";
import { DetailView } from "./DetailView.js";
import { GenerateView } from "./GenerateView.js";
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
	| "generate"
	| "processing"
	| "exiting"
	| "confirm-delete"
	| "error";

interface AppState {
	mode: AppMode;
	previousMode: AppMode | null;
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
		previousMode: null,
		session: null,
		items: [],
		selectedIndex: 0,
		selectedItem: null,
		error: null,
		config: loadConfig(),
		message: null,
	}));

	const { query, setQuery, results, sortMode, setSortMode } = useSearch(
		state.items,
	);

	// Calculate scroll offset for visible window
	const maxVisible = state.config.max_visible_entries;
	const scrollOffset = Math.max(
		0,
		state.selectedIndex - Math.floor(maxVisible / 2),
	);

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

	// Handle exiting mode - perform cleanup after render shows "Locking vault..."
	useEffect(() => {
		if (state.mode === "exiting") {
			// Use setTimeout to ensure the UI renders first
			const timer = setTimeout(() => {
				cleanup();
				exit();
			}, 50);
			return () => clearTimeout(timer);
		}
	}, [state.mode, cleanup, exit]);

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
	const handlePasswordSubmit = useCallback((password: string) => {
		// Show loading indicator first, then perform blocking operations
		setState((s) => ({ ...s, mode: "loading", error: null }));

		// Use setTimeout to let UI render before blocking calls
		setTimeout(() => {
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
		}, 50);
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

	// Handle create new item via editor
	const handleCreate = useCallback(() => {
		if (!state.session) return;

		const template = getCreateTemplate();
		const result = openInEditor(template, "new-login.yaml");

		if (!result.success) {
			showMessage(`Editor error: ${result.error}`);
			return;
		}

		if (result.cancelled || !result.content) {
			showMessage("Create cancelled");
			return;
		}

		const item = yamlToItem(result.content);
		if (!item) {
			showMessage("Invalid YAML or missing required fields");
			return;
		}

		// Show processing indicator - use setTimeout to let UI render first
		setState((s) => ({ ...s, mode: "processing" }));
		setTimeout(() => {
			const createResult = createItem(state.session as string, item);
			if (!createResult.success) {
				setState((s) => ({ ...s, mode: "search" }));
				showMessage(`Create failed: ${createResult.error}`);
				return;
			}

			// Sync and refresh items list
			syncVault(state.session as string);
			try {
				const items = listItems(state.session as string);
				// Find the newly created item and navigate to detail view
				const newItem = createResult.item;
				setState((s) => ({
					...s,
					items,
					selectedItem: newItem ?? null,
					mode: newItem ? "detail" : "search",
				}));
				showMessage(`Created: ${item.name}`);
			} catch {
				setState((s) => ({ ...s, mode: "search" }));
				showMessage("Created but failed to refresh list");
			}
		}, 50);
	}, [state.session, showMessage]);

	// Handle edit item via editor
	const handleEdit = useCallback(() => {
		if (!state.session || !state.selectedItem) return;

		// Only Login items are supported for editing currently
		if (state.selectedItem.type !== CipherType.Login) {
			showMessage("Only login items can be edited");
			return;
		}

		const yaml = itemToYaml(state.selectedItem);
		const result = openInEditor(yaml, "edit-login.yaml");

		if (!result.success) {
			showMessage(`Editor error: ${result.error}`);
			return;
		}

		if (result.cancelled || !result.content) {
			showMessage("Edit cancelled");
			return;
		}

		const parsedItem = yamlToItem(result.content);
		if (!parsedItem) {
			showMessage("Invalid YAML or missing required fields");
			return;
		}

		// Check if anything actually changed
		if (itemsEqual(state.selectedItem, parsedItem)) {
			showMessage("No changes");
			return;
		}

		// CRITICAL: Merge parsed data with original item to preserve all metadata
		// BW CLI does a REPLACE, not a merge - we must include all original fields
		const originalItem = state.selectedItem;
		const mergedItem: Partial<BwItem> = {
			...originalItem, // Preserve id, organizationId, folderId, etc.
			...parsedItem, // Override with edited fields
			login: {
				...originalItem.login, // Preserve any login fields not in YAML
				...parsedItem.login, // Override with edited login fields
			},
		};

		const selectedItemId = originalItem.id;

		// Show processing indicator - use setTimeout to let UI render first
		setState((s) => ({ ...s, mode: "processing" }));
		setTimeout(() => {
			const editResult = editItem(
				state.session as string,
				selectedItemId,
				mergedItem,
			);
			if (!editResult.success) {
				setState((s) => ({ ...s, mode: "detail" }));
				showMessage(`Edit failed: ${editResult.error}`);
				return;
			}

			// Sync and refresh items list
			syncVault(state.session as string);
			try {
				const items = listItems(state.session as string);
				const updatedItem = items.find((i) => i.id === selectedItemId);
				setState((s) => ({
					...s,
					items,
					selectedItem: updatedItem ?? null,
					mode: "detail",
				}));
				showMessage(`Updated: ${mergedItem.name}`);
			} catch {
				setState((s) => ({ ...s, mode: "detail" }));
				showMessage("Updated but failed to refresh list");
			}
		}, 50);
	}, [state.session, state.selectedItem, showMessage]);

	// Handle password copy from generator
	const handleGeneratorCopy = useCallback(
		(password: string) => {
			const result = copyToClipboard(password);
			if (result.success) {
				showMessage("Password copied!");
				scheduleClipboardClear(state.config.clipboard_clear_seconds);
			} else {
				showMessage(`Copy failed: ${result.error}`);
			}
		},
		[state.config.clipboard_clear_seconds, showMessage],
	);

	// Handle generator exit
	const handleGeneratorExit = useCallback(() => {
		setState((s) => ({
			...s,
			mode: s.previousMode ?? "search",
			previousMode: null,
		}));
	}, []);

	// Handle config edit in shortcut mode
	const handleEditConfig = useCallback(() => {
		const configPath = getConfigPath();
		const editor = getEditor();

		// Open editor directly on config file
		const result = spawnSync(editor, [configPath], {
			stdio: "inherit",
			shell: true,
		});

		if (result.status !== 0) {
			showMessage(`Editor exited with code ${result.status}`);
			setState((s) => ({ ...s, mode: "search" }));
			return;
		}

		// Reload config and update state
		const newConfig = loadConfig();
		setState((s) => ({ ...s, config: newConfig, mode: "search" }));
		showMessage(`Config reloaded (${newConfig.shortcuts.length} shortcuts)`);
	}, [showMessage]);

	// Keyboard input handling
	useInput((input, key) => {
		// Global: Ctrl+D or Ctrl+C to quit
		if ((key.ctrl && input === "d") || (key.ctrl && input === "c")) {
			cleanup();
			exit();
			return;
		}

		// Password mode - handled by PasswordPrompt
		// Generate mode - handled by GenerateView
		// Processing/Exiting modes - ignore all input
		if (
			state.mode === "password" ||
			state.mode === "loading" ||
			state.mode === "error" ||
			state.mode === "generate" ||
			state.mode === "processing" ||
			state.mode === "exiting"
		) {
			return;
		}

		// Confirm delete mode - y to confirm, anything else to cancel
		if (state.mode === "confirm-delete") {
			if (input.toLowerCase() === "y" && state.selectedItem && state.session) {
				const itemName = state.selectedItem.name;
				const itemId = state.selectedItem.id;

				// Show processing indicator
				setState((s) => ({ ...s, mode: "processing" }));
				setTimeout(() => {
					const result = deleteItem(state.session as string, itemId);
					if (!result.success) {
						setState((s) => ({ ...s, mode: "detail" }));
						showMessage(`Delete failed: ${result.error}`);
						return;
					}

					// Refresh items list
					try {
						const items = listItems(state.session as string);
						setState((s) => ({
							...s,
							items,
							selectedItem: null,
							selectedIndex: 0,
							mode: "search",
						}));
						showMessage(`Moved to trash: ${itemName}`);
					} catch {
						setState((s) => ({
							...s,
							mode: "search",
							selectedItem: null,
							selectedIndex: 0,
						}));
						showMessage("Deleted but failed to refresh list");
					}
				}, 50);
			} else {
				// Cancel - go back to detail
				setState((s) => ({ ...s, mode: "detail" }));
				showMessage("Delete cancelled");
			}
			return;
		}

		// Escape to go back / close
		if (key.escape) {
			if (state.mode === "detail") {
				setState((s) => ({ ...s, mode: "search", selectedItem: null }));
			} else if (state.mode === "shortcut") {
				setState((s) => ({ ...s, mode: "search" }));
			} else {
				// Show exiting indicator, actual exit handled by useEffect
				setState((s) => ({ ...s, mode: "exiting" }));
			}
			return;
		}

		// Backspace to go back (safer than Esc - won't exit from wrong mode)
		if (key.backspace || key.delete) {
			if (state.mode === "detail") {
				setState((s) => ({ ...s, mode: "search", selectedItem: null }));
				return;
			}
			if (state.mode === "shortcut") {
				setState((s) => ({ ...s, mode: "search" }));
				return;
			}
		}

		// Shortcut mode
		if (state.mode === "shortcut") {
			// Ctrl+E edits config file
			if (key.ctrl && input === "e") {
				handleEditConfig();
				return;
			}

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
			// Ctrl+G opens password generator
			if (key.ctrl && input === "g") {
				setState((s) => ({
					...s,
					mode: "generate",
					previousMode: s.mode,
				}));
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
			// Ctrl+N creates new item (search mode only)
			if (key.ctrl && input === "n" && state.mode === "search") {
				handleCreate();
				return;
			}
			// Ctrl+E edits selected item (detail mode only)
			if (key.ctrl && input === "e" && state.mode === "detail") {
				handleEdit();
				return;
			}
			// 'd' key in detail mode triggers delete confirmation
			if (input === "d" && state.mode === "detail" && !key.ctrl) {
				setState((s) => ({ ...s, mode: "confirm-delete" }));
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

			// Ctrl+O toggles sort order
			if (key.ctrl && input === "o") {
				setSortMode((current) => (current === "default" ? "date" : "default"));
				showMessage(
					sortMode === "default" ? "Sort: by date" : "Sort: by relevance",
				);
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

	if (state.mode === "exiting") {
		return (
			<Box padding={1}>
				<Text color="yellow">⏳ Locking vault...</Text>
			</Box>
		);
	}

	if (state.mode === "processing") {
		return (
			<Box padding={1}>
				<Text color="yellow">⏳ Processing...</Text>
			</Box>
		);
	}

	if (state.mode === "generate") {
		return (
			<GenerateView
				config={state.config.password_generation}
				onCopy={handleGeneratorCopy}
				onExit={handleGeneratorExit}
			/>
		);
	}

	if (state.mode === "shortcut") {
		return <ShortcutMode shortcuts={state.config.shortcuts} />;
	}

	if (state.mode === "confirm-delete" && state.selectedItem) {
		return (
			<Box flexDirection="column" padding={1}>
				<Box borderStyle="single" borderColor="red" paddingX={1}>
					<Text bold color="red">
						Delete: {state.selectedItem.name}
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text>
						Move this item to trash? Press <Text color="yellow">Y</Text> to
						confirm, any other key to cancel.
					</Text>
				</Box>
			</Box>
		);
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
					[↑↓/PgUp/Dn] nav [Alt+1-9] jump [Enter] detail [Ctrl+S] shortcuts
					[Ctrl+O] order [Ctrl+U]ser [Ctrl+P]ass [Ctrl+T]OTP [Ctrl+G] gen
					[Ctrl+N] new [Ctrl+R] sync [Esc] quit
				</Text>
			</Box>
		</Box>
	);
}
