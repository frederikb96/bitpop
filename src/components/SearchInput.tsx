import { Box, Text, useInput } from "ink";
import React from "react";

interface SearchInputProps {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}

export function SearchInput({ value, onChange, disabled }: SearchInputProps) {
	useInput(
		(input, key) => {
			if (disabled) return;

			if (key.backspace || key.delete) {
				onChange(value.slice(0, -1));
			} else if (!key.ctrl && !key.meta && !key.return && input) {
				onChange(value + input);
			}
		},
		{ isActive: !disabled },
	);

	return (
		<Box>
			<Text color="blue" bold>
				Search:{" "}
			</Text>
			<Text>{value}</Text>
			{!disabled && <Text color="gray">|</Text>}
		</Box>
	);
}
