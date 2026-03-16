<script lang="ts">
	import mermaid from "mermaid";
	import CodeBlock from "../CodeBlock.svelte";

	interface Props {
		code: string;
		loading?: boolean;
	}

	let { code, loading = false }: Props = $props();

	let svg = $state("");
	let error = $state(false);
	let lastRendered = $state("");

	const id = `mermaid-${crypto.randomUUID().slice(0, 8)}`;

	mermaid.initialize({ startOnLoad: false, theme: "neutral" });

	async function render(source: string) {
		if (!source || loading) {
			svg = "";
			error = false;
			return;
		}
		if (source === lastRendered) return;
		try {
			const result = await mermaid.render(id, source);
			svg = result.svg;
			error = false;
			lastRendered = source;
		} catch {
			svg = "";
			error = true;
			lastRendered = source;
		}
	}

	$effect(() => {
		render(code);
	});
</script>

{#if loading}
	<CodeBlock code={code} rawCode={code} loading={true} />
{:else if error || !svg}
	<CodeBlock code={code} rawCode={code} />
{:else}
	<div class="my-4 flex justify-center overflow-auto">
		{@html svg}
	</div>
{/if}
