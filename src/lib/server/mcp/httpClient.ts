import { Client } from "@modelcontextprotocol/sdk/client";
import { getClient, evictFromPool } from "./clientPool";
import { config } from "$lib/server/config";
import { logger } from "$lib/server/logger";

function isConnectionClosedError(err: unknown): boolean {
	const message = err instanceof Error ? err.message : String(err);
	return message.includes("-32000") || message.toLowerCase().includes("connection closed");
}

export interface McpServerConfig {
	name: string;
	url: string;
	headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 120_000;

export function getMcpToolTimeoutMs(): number {
	const envValue = config.MCP_TOOL_TIMEOUT_MS;
	if (envValue) {
		const parsed = parseInt(envValue, 10);
		if (!isNaN(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return DEFAULT_TIMEOUT_MS;
}

export type McpToolTextResponse = {
	text: string;
	/** If the server returned structuredContent, include it raw */
	structured?: unknown;
	/** Raw content blocks returned by the server, if any */
	content?: unknown[];
};

export type McpToolProgress = {
	progress: number;
	total?: number;
	message?: string;
};

export async function callMcpTool(
	server: McpServerConfig,
	tool: string,
	args: unknown = {},
	{
		timeoutMs = DEFAULT_TIMEOUT_MS,
		signal,
		client,
		onProgress,
	}: {
		timeoutMs?: number;
		signal?: AbortSignal;
		client?: Client;
		onProgress?: (progress: McpToolProgress) => void;
	} = {}
): Promise<McpToolTextResponse> {
	const normalizedArgs =
		typeof args === "object" && args !== null && !Array.isArray(args)
			? (args as Record<string, unknown>)
			: undefined;

	// Get a (possibly pooled) client. The client itself was connected with a signal
	// that already composes outer cancellation. We still enforce a per-call timeout here.
	let activeClient = client ?? (await getClient(server, signal));

	const callToolOptions = {
		signal,
		timeout: timeoutMs,
		// Enable progress tokens so long-running tools keep extending the timeout.
		onprogress: (progress: McpToolProgress) => {
			onProgress?.({
				progress: progress.progress,
				total: progress.total,
				message: progress.message,
			});
		},
		resetTimeoutOnProgress: true,
	};

	let response;
	try {
		response = await activeClient.callTool(
			{ name: tool, arguments: normalizedArgs },
			undefined,
			callToolOptions
		);
	} catch (err) {
		if (!isConnectionClosedError(err)) {
			throw err;
		}

		// Evict stale client and close it
		const stale = evictFromPool(server);
		stale?.close?.().catch(() => {});

		// Retry with fresh client
		activeClient = await getClient(server, signal);
		response = await activeClient.callTool(
			{ name: tool, arguments: normalizedArgs },
			undefined,
			callToolOptions
		);
	}

	const parts = Array.isArray(response?.content) ? (response.content as Array<unknown>) : [];
	const textParts = parts
		.filter((part): part is { type: "text"; text: string } => {
			if (typeof part !== "object" || part === null) return false;
			const obj = part as Record<string, unknown>;
			return obj["type"] === "text" && typeof obj["text"] === "string";
		})
		.map((p) => p.text);

	const text = textParts.join("\n");
	const structured = (response as unknown as { structuredContent?: unknown })?.structuredContent;
	const contentBlocks = Array.isArray(response?.content)
		? (response.content as unknown[])
		: undefined;
	return { text, structured, content: contentBlocks };
}

/**
 * Read a resource from an MCP server (e.g. a ui:// resource for MCP Apps).
 * Returns the resource text and mimeType, or null if the read fails.
 */
export async function readMcpResource(
	server: McpServerConfig,
	uri: string,
	{ signal }: { signal?: AbortSignal } = {}
): Promise<{ mimeType: string; text: string } | null> {
	try {
		const client = await getClient(server, signal);
		const response = await client.readResource({ uri });
		const contents = Array.isArray(response?.contents) ? response.contents : [];
		for (const entry of contents) {
			const obj = entry as Record<string, unknown>;
			if (typeof obj["text"] === "string") {
				return {
					mimeType: typeof obj["mimeType"] === "string" ? obj["mimeType"] : "text/html",
					text: obj["text"] as string,
				};
			}
		}
		return null;
	} catch (err) {
		logger.warn({ server: server.name, uri, err: String(err) }, "[mcp] failed to read resource");
		return null;
	}
}
