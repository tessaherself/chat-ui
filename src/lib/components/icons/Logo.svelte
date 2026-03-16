<script lang="ts">
	import { usePublicConfig } from "$lib/utils/PublicConfig.svelte";

	const publicConfig = usePublicConfig();

	interface Props {
		classNames?: string;
		variant?: "default" | "nav";
	}

	let { classNames = "", variant = "default" }: Props = $props();

	let logoSrc = $derived(
		variant === "nav"
			? (publicConfig.PUBLIC_APP_LOGO_NAV_URL || `${publicConfig.assetPath}/logo.svg`)
			: (publicConfig.PUBLIC_APP_LOGO_URL || `${publicConfig.assetPath}/logo.svg`)
	);

	let logoStyle = $derived(
		variant === "nav"
			? (publicConfig.PUBLIC_APP_LOGO_NAV_STYLE || "height: 1.5em; width: auto;")
			: (publicConfig.PUBLIC_APP_LOGO_STYLE || "")
	);
</script>

<img
	class={classNames}
	style={logoStyle}
	alt="{publicConfig.PUBLIC_APP_NAME} logo"
	src={logoSrc}
/>
