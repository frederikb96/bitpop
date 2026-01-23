import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

interface PasswordPromptProps {
	onSubmit: (password: string) => void;
	error?: string;
	loading?: boolean;
}

export function PasswordPrompt({
	onSubmit,
	error,
	loading,
}: PasswordPromptProps) {
	const [password, setPassword] = useState("");

	useInput((input, key) => {
		if (loading) return;

		if (key.return) {
			onSubmit(password);
		} else if (key.backspace || key.delete) {
			setPassword((p) => p.slice(0, -1));
		} else if (!key.ctrl && !key.meta && input) {
			setPassword((p) => p + input);
		}
	});

	const maskedPassword = "*".repeat(password.length);

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold color="blue">
				Bitwarden Vault Unlock
			</Text>
			<Box marginTop={1}>
				<Text>Master Password: </Text>
				<Text>{loading ? "(unlocking...)" : maskedPassword}</Text>
				{!loading && <Text color="gray">|</Text>}
			</Box>
			{error && (
				<Box marginTop={1}>
					<Text color="red">{error}</Text>
				</Box>
			)}
			<Box marginTop={1}>
				<Text color="gray">Press Enter to unlock, Ctrl+C to cancel</Text>
			</Box>
		</Box>
	);
}
