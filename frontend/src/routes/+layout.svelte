<script lang="ts">
	import { fade } from "svelte/transition";
</script>

<div in:fade={{ duration: 300, delay: 300 }} out:fade={{ duration: 300 }}>
	<slot />
</div>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		padding: 0;
		background-color: #1a1a1a;
		color: #e0e0e0;
		font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
		overflow-x: hidden;
		width: 100%;
	}
</style>
