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

export function useSearch(items: BwItem[]) {
	const [query, setQuery] = useState("");

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
		if (!query.trim()) {
			// No query - return all items sorted by name
			return items
				.map((item) => ({ item, score: 0 }))
				.sort((a, b) => a.item.name.localeCompare(b.item.name));
		}

		const matches = fuzzySearch(query.toLowerCase());
		return matches.map((match) => ({
			item: match.item.item,
			score: match.score,
		}));
	}, [query, items, fuzzySearch]);

	return {
		query,
		setQuery,
		results,
	};
}
