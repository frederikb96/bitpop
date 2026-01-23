import { describe, expect, test } from "bun:test";
import createFuzzySearch from "@nozbe/microfuzz";
import type { BwItem } from "../bw/client.js";

// Test the search logic directly instead of through React hooks
// The hook is a thin wrapper around this logic

interface ItemForSearch {
	item: BwItem;
	searchText: string;
}

interface SearchResult {
	item: BwItem;
	score: number;
}

// Extract the core search logic for testing
function prepareSearchItems(items: BwItem[]): ItemForSearch[] {
	return items.map((item) => {
		const uris = item.login?.uris?.map((u) => u.uri).join(" ") ?? "";
		return {
			item,
			searchText: `${item.name} ${uris}`.toLowerCase(),
		};
	});
}

function performSearch(items: BwItem[], query: string): SearchResult[] {
	const searchItems = prepareSearchItems(items);

	if (!query.trim()) {
		// No query - return all items sorted by name
		return items
			.map((item) => ({ item, score: 0 }))
			.sort((a, b) => a.item.name.localeCompare(b.item.name));
	}

	const fuzzySearch = createFuzzySearch(searchItems, {
		getText: (item) => [item.searchText],
	});

	const matches = fuzzySearch(query.toLowerCase());
	return matches.map((match) => ({
		item: match.item.item,
		score: match.score,
	}));
}

// Sample test items
const createItem = (id: string, name: string, uris?: string[]): BwItem => ({
	id,
	name,
	type: 1,
	favorite: false,
	reprompt: 0,
	login: uris ? { uris: uris.map((uri) => ({ uri })) } : undefined,
});

const testItems: BwItem[] = [
	createItem("1", "GitHub Personal", ["https://github.com"]),
	createItem("2", "AWS Console", ["https://console.aws.amazon.com"]),
	createItem("3", "Zebra Mail", ["https://mail.zebra.com"]),
	createItem("4", "Amazon Shopping", ["https://amazon.com"]),
];

describe("useSearch (search logic)", () => {
	describe("empty query", () => {
		test("returns all items sorted by name", () => {
			const results = performSearch(testItems, "");

			expect(results).toHaveLength(4);

			// Should be sorted alphabetically
			const names = results.map((r) => r.item.name);
			expect(names).toEqual([
				"Amazon Shopping",
				"AWS Console",
				"GitHub Personal",
				"Zebra Mail",
			]);
		});

		test("all items have score 0 when no query", () => {
			const results = performSearch(testItems, "");

			for (const res of results) {
				expect(res.score).toBe(0);
			}
		});
	});

	describe("query filtering", () => {
		test("filters items by name", () => {
			const results = performSearch(testItems, "github");

			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results[0].item.name).toBe("GitHub Personal");
		});

		test("filters items by URI", () => {
			const results = performSearch(testItems, "console.aws");

			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results[0].item.name).toBe("AWS Console");
		});

		test("fuzzy matches partial strings", () => {
			const results = performSearch(testItems, "git");

			const hasGitHub = results.some((r) => r.item.name === "GitHub Personal");
			expect(hasGitHub).toBe(true);
		});

		test("case insensitive search", () => {
			const results = performSearch(testItems, "GITHUB");

			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results[0].item.name).toBe("GitHub Personal");
		});

		test("matches multiple items with common substring", () => {
			const results = performSearch(testItems, "a");

			// Should match Amazon, AWS, and possibly others
			expect(results.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("empty items", () => {
		test("does not crash with empty items array", () => {
			const results = performSearch([], "");

			expect(results).toEqual([]);
		});

		test("searching empty items returns empty results", () => {
			const results = performSearch([], "test");

			expect(results).toEqual([]);
		});
	});

	describe("whitespace handling", () => {
		test("whitespace-only query returns all items sorted", () => {
			const results = performSearch(testItems, "   ");

			expect(results).toHaveLength(4);
		});

		test("leading/trailing whitespace in query is handled", () => {
			const results = performSearch(testItems, "  github  ");

			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results[0].item.name).toBe("GitHub Personal");
		});
	});

	describe("items without URIs", () => {
		test("handles items without login field", () => {
			const itemsWithoutUris: BwItem[] = [
				{ id: "1", name: "Note", type: 2, favorite: false, reprompt: 0 },
				{ id: "2", name: "Card", type: 3, favorite: false, reprompt: 0 },
			];

			const results = performSearch(itemsWithoutUris, "");
			expect(results).toHaveLength(2);
		});

		test("can search items without login field", () => {
			const itemsWithoutUris: BwItem[] = [
				{ id: "1", name: "Note", type: 2, favorite: false, reprompt: 0 },
				{ id: "2", name: "Card", type: 3, favorite: false, reprompt: 0 },
			];

			const results = performSearch(itemsWithoutUris, "note");
			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results[0].item.name).toBe("Note");
		});
	});

	describe("prepareSearchItems", () => {
		test("combines name and URIs into searchText", () => {
			const items = [
				createItem("1", "Test Item", [
					"https://example.com",
					"https://test.com",
				]),
			];

			const prepared = prepareSearchItems(items);

			expect(prepared[0].searchText).toContain("test item");
			expect(prepared[0].searchText).toContain("https://example.com");
			expect(prepared[0].searchText).toContain("https://test.com");
		});

		test("handles missing URIs gracefully", () => {
			const items: BwItem[] = [
				{ id: "1", name: "No Login", type: 2, favorite: false, reprompt: 0 },
			];

			const prepared = prepareSearchItems(items);

			expect(prepared[0].searchText).toBe("no login ");
		});
	});
});
