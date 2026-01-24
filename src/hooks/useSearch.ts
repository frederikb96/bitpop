import createFuzzySearch from "@nozbe/microfuzz";
import { useMemo, useState } from "react";
import type { BwItem } from "../bw/client.js";

export interface SearchResult {
	item: BwItem;
	score: number;
}

interface ItemForSearch {
	item: BwItem;
	searchText: string;
}

export type SortMode = "default" | "date";

export function useSearch(items: BwItem[]) {
	const [query, setQuery] = useState("");
	const [sortMode, setSortMode] = useState<SortMode>("default");

	// Prepare items for search: combine name + URIs
	const searchItems = useMemo<ItemForSearch[]>(() => {
		return items.map((item) => {
			const uris = item.login?.uris?.map((u) => u.uri).join(" ") ?? "";
			return {
				item,
				searchText: `${item.name} ${uris}`.toLowerCase(),
			};
		});
	}, [items]);

	// Create fuzzy search function
	const fuzzySearch = useMemo(() => {
		return createFuzzySearch(searchItems, {
			getText: (item) => [item.searchText],
		});
	}, [searchItems]);

	// Compute results
	const results = useMemo<SearchResult[]>(() => {
		// Sort by revision date (newest first)
		const sortByDate = (a: SearchResult, b: SearchResult): number => {
			const dateA = a.item.revisionDate ?? "";
			const dateB = b.item.revisionDate ?? "";
			return dateB.localeCompare(dateA);
		};

		if (!query.trim()) {
			// No query - return all items
			const mapped = items.map((item) => ({ item, score: 0 }));
			if (sortMode === "date") {
				return mapped.sort(sortByDate);
			}
			return mapped.sort((a, b) => a.item.name.localeCompare(b.item.name));
		}

		const matches = fuzzySearch(query.toLowerCase());
		const mapped = matches.map((match) => ({
			item: match.item.item,
			score: match.score,
		}));

		if (sortMode === "date") {
			return mapped.sort(sortByDate);
		}
		return mapped;
	}, [query, items, fuzzySearch, sortMode]);

	return {
		query,
		setQuery,
		results,
		sortMode,
		setSortMode,
	};
}
