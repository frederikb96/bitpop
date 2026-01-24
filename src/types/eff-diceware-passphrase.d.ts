declare module "eff-diceware-passphrase" {
	/**
	 * Generate a passphrase with the specified number of words.
	 * Uses EFF's improved Diceware wordlist (7776 words).
	 */
	function generatePassphrase(count: number): string[];

	namespace generatePassphrase {
		/**
		 * Generate a passphrase with at least the specified bits of entropy.
		 */
		function entropy(minimum: number): string[];

		/**
		 * Sorted array of all words in the EFF Diceware wordlist.
		 */
		const words: string[];

		/**
		 * Find the index of a word in the wordlist.
		 */
		function indexOf(word: string): number;

		/**
		 * Check if a word exists in the wordlist.
		 */
		function includes(word: string): boolean;

		/**
		 * Find the index of the first word with the given prefix.
		 */
		function indexOfPrefix(prefix: string): number;
	}

	export = generatePassphrase;
}
