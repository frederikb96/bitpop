import { Box, Text } from "ink";
import React from "react";
import { type BwItem, CipherType } from "../bw/client.js";
import type { SearchResult } from "../hooks/useSearch.js";

interface ResultsListProps {
	results: SearchResult[];
	selectedIndex: number;
	maxVisible?: number;
	scrollOffset?: number;
}

function getTypeLabel(type: CipherType): string {
	switch (type) {
		case CipherType.Login:
			return "LOGIN";
		case CipherType.Card:
			return "CARD";
		case CipherType.Identity:
			return "ID";
		case CipherType.SecureNote:
			return "NOTE";
		case CipherType.SshKey:
			return "SSH";
		default:
			return "???";
	}
}

function getTypeColor(type: CipherType): string {
	switch (type) {
		case CipherType.Login:
			return "green";
		case CipherType.Card:
			return "yellow";
		case CipherType.Identity:
			return "cyan";
		case CipherType.SecureNote:
			return "magenta";
		case CipherType.SshKey:
			return "blue";
		default:
			return "white";
	}
}

function getSubtitle(item: BwItem): string {
	switch (item.type) {
		case CipherType.Login:
			return item.login?.username ?? "";
		case CipherType.Card:
			return item.card?.brand ?? "";
		case CipherType.Identity:
			return item.identity?.email ?? "";
		case CipherType.SecureNote:
			return item.notes?.slice(0, 30) ?? "";
		case CipherType.SshKey:
			return item.sshKey?.keyFingerprint ?? "";
		default:
			return "";
	}
}

export function ResultsList({
	results,
	selectedIndex,
	maxVisible = 10,
	scrollOffset = 0,
}: ResultsListProps) {
	// Use provided scroll offset or calculate it
	const startIdx = scrollOffset;
	const visibleResults = results.slice(startIdx, startIdx + maxVisible);
	const displayStartIdx = startIdx;

	if (results.length === 0) {
		return (
			<Box marginTop={1}>
				<Text color="gray">No results found</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" marginTop={1}>
			{visibleResults.map((result, visibleIdx) => {
				const actualIdx = displayStartIdx + visibleIdx;
				const isSelected = actualIdx === selectedIndex;
				const displayNum =
					visibleIdx < 9 ? visibleIdx + 1 : visibleIdx === 9 ? 0 : "";

				return (
					<Box key={result.item.id}>
						<Text color={isSelected ? "blue" : "gray"} bold={isSelected}>
							{isSelected ? "▶" : " "}
						</Text>
						<Text color="gray"> {displayNum !== "" ? displayNum : " "} </Text>
						<Text color={getTypeColor(result.item.type)}>
							[{getTypeLabel(result.item.type)}]
						</Text>
						<Text color={isSelected ? "white" : undefined} bold={isSelected}>
							{" "}
							{result.item.name}
						</Text>
						{getSubtitle(result.item) && (
							<Text color="gray"> - {getSubtitle(result.item)}</Text>
						)}
					</Box>
				);
			})}
			{results.length > maxVisible && (
				<Box marginTop={1}>
					<Text color="gray">
						Showing {displayStartIdx + 1}-
						{Math.min(displayStartIdx + maxVisible, results.length)} of{" "}
						{results.length}
					</Text>
				</Box>
			)}
		</Box>
	);
}
