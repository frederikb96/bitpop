import { Box, Text, useInput } from "ink";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { PasswordGenerationConfig } from "../config.js";
import { generatePassword } from "../utils/password.js";

interface GenerateViewProps {
	config: PasswordGenerationConfig;
	onCopy: (password: string) => void;
	onExit: () => void;
}

export function GenerateView({ config, onCopy, onExit }: GenerateViewProps) {
	const [isPassphrase, setIsPassphrase] = useState(
		config.type === "passphrase",
	);
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const showMessage = useCallback((msg: string) => {
		if (messageTimerRef.current) {
			clearTimeout(messageTimerRef.current);
		}
		setMessage(msg);
		messageTimerRef.current = setTimeout(() => {
			setMessage(null);
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

	const regenerate = useCallback(() => {
		const result = generatePassword({
			type: isPassphrase ? "passphrase" : "random",
			length: config.length,
			uppercase: config.uppercase,
			lowercase: config.lowercase,
			number: config.number,
			special: config.special,
			words: config.words,
			separator: config.separator,
			capitalize: config.capitalize,
			includeNumber: config.includeNumber,
		});

		if (result.success && result.password) {
			setPassword(result.password);
			setError(null);
		} else {
			setError(result.error ?? "Failed to generate password");
		}
	}, [isPassphrase, config]);

	// Generate on mount and when type changes
	useEffect(() => {
		regenerate();
	}, [regenerate]);

	useInput((input, key) => {
		// Escape or Backspace to exit without copying
		if (key.escape || key.backspace || key.delete) {
			onExit();
			return;
		}

		// Enter to copy and exit
		if (key.return) {
			if (password) {
				onCopy(password);
			}
			onExit();
			return;
		}

		// Ctrl+P to copy and stay
		if (key.ctrl && input === "p") {
			if (password) {
				onCopy(password);
				showMessage("Password copied!");
			}
			return;
		}

		// Tab or arrow keys to toggle type
		if (key.tab || key.leftArrow || key.rightArrow) {
			setIsPassphrase((p) => !p);
			return;
		}

		// Ctrl+R to regenerate
		if (key.ctrl && input === "r") {
			regenerate();
			return;
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color="blue">
					Password Generator
				</Text>
			</Box>

			{/* Type toggle */}
			<Box marginBottom={1}>
				<Text>Type: </Text>
				<Text color={!isPassphrase ? "green" : "gray"} bold={!isPassphrase}>
					{!isPassphrase ? "[x]" : "[ ]"} Random
				</Text>
				<Text> </Text>
				<Text color={isPassphrase ? "green" : "gray"} bold={isPassphrase}>
					{isPassphrase ? "[x]" : "[ ]"} Passphrase
				</Text>
				<Text color="gray"> (Tab to switch)</Text>
			</Box>

			{/* Settings info */}
			<Box marginBottom={1}>
				{isPassphrase ? (
					<Text color="gray">
						Words: {config.words}, Sep: "{config.separator}"
						{config.capitalize ? ", Caps" : ""}
						{config.includeNumber ? ", Nums" : ""}
					</Text>
				) : (
					<Text color="gray">
						Length: {config.length}
						{config.uppercase ? " A-Z" : ""}
						{config.lowercase ? " a-z" : ""}
						{config.number ? " 0-9" : ""}
						{config.special ? " !@#" : ""}
					</Text>
				)}
			</Box>

			{/* Generated password */}
			<Box borderStyle="round" borderColor="green" paddingX={2} paddingY={1}>
				{error ? (
					<Text color="red">{error}</Text>
				) : (
					<Text color="white" bold>
						{password}
					</Text>
				)}
			</Box>

			{/* Message */}
			{message && (
				<Box marginTop={1}>
					<Text color="green">{message}</Text>
				</Box>
			)}

			{/* Help */}
			<Box marginTop={1} flexDirection="column">
				<Text color="gray">
					[Enter] Copy & Exit [Ctrl+P] Copy [Ctrl+R] Regenerate
				</Text>
				<Text color="gray">
					[Tab/Arrows] Toggle type [Esc/Backspace] Cancel
				</Text>
			</Box>
		</Box>
	);
}
