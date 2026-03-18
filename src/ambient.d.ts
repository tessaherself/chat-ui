declare module "*.ttf" {
	const value: ArrayBuffer;
	export default value;
}

declare const __APP_VERSION__: string;

// Legacy helpers removed: web search support is deprecated, so we intentionally
// avoid leaking those shapes into the global ambient types.
