<script lang="ts">
	import { onMount } from "svelte";

	interface Props {
		html: string;
		toolResult?: Record<string, unknown>;
	}

	let { html, toolResult }: Props = $props();

	let iframeEl: HTMLIFrameElement | undefined = $state(undefined);
	let height = $state(200);

	onMount(() => {
		function handleMessage(event: MessageEvent) {
			if (!iframeEl || event.source !== iframeEl.contentWindow) return;

			const data = event.data;
			if (typeof data !== "object" || data === null) return;

			// Handle JSON-RPC messages from the MCP App
			if (data.jsonrpc === "2.0") {
				if (data.method === "resize" && typeof data.params?.height === "number") {
					height = Math.min(data.params.height, 800);
				} else if (data.method === "openLink" && typeof data.params?.url === "string") {
					window.open(data.params.url, "_blank", "noopener,noreferrer");
				} else if (data.method === "sendLog") {
					console.debug("[mcp-app]", data.params?.message ?? data.params);
				}
			}

			// Handle simple resize messages (non-JSON-RPC)
			if (data.type === "resize" && typeof data.height === "number") {
				height = Math.min(data.height, 800);
			}
		}

		window.addEventListener("message", handleMessage);

		return () => window.removeEventListener("message", handleMessage);
	});

	// Push tool result data into the iframe once it loads
	function handleLoad() {
		if (!iframeEl?.contentWindow || !toolResult) return;
		iframeEl.contentWindow.postMessage(
			{
				jsonrpc: "2.0",
				method: "toolResult",
				params: { content: toolResult },
			},
			"*"
		);
	}
</script>

<div class="my-2 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
	<iframe
		bind:this={iframeEl}
		srcdoc={html}
		sandbox="allow-scripts"
		title="MCP App"
		class="w-full border-0"
		style="height: {height}px; max-height: 800px;"
		onload={handleLoad}
	></iframe>
</div>
