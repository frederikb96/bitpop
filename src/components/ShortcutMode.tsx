import { Box, Text } from "ink";
import React from "react";
import type { Shortcut } from "../config.js";

interface ShortcutModeProps {
	shortcuts: Shortcut[];
}

export function ShortcutMode({ shortcuts }: ShortcutModeProps) {
	if (shortcuts.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="blue">
					Shortcut Mode
				</Text>
				<Box marginTop={1}>
					<Text color="gray">No shortcuts configured.</Text>
				</Box>
				<Box marginTop={1}>
					<Text color="gray">
						Add shortcuts in ~/.config/bitpop/config.yaml
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text color="gray">[Esc] to exit shortcut mode</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold color="blue">
				Shortcut Mode
			</Text>
			<Box flexDirection="column" marginTop={1}>
				{shortcuts.map((shortcut) => (
					<Box key={shortcut.key}>
						<Text color="yellow" bold>
							[{shortcut.key}]
						</Text>
						<Text> {shortcut.description ?? shortcut.search}</Text>
					</Box>
				))}
			</Box>
			<Box marginTop={1}>
				<Text color="gray">[Esc] to exit shortcut mode</Text>
			</Box>
		</Box>
	);
}
