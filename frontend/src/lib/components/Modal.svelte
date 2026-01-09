<script lang="ts">
	import { fade, scale } from "svelte/transition";
	export let show = false;
	export let onClose: (() => void) | null = null;
</script>

{#if show}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="modal-backdrop" on:click={onClose} transition:fade={{ duration: 200 }}>
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="modal" on:click|stopPropagation transition:scale={{ duration: 300, start: 0.95, opacity: 0 }}>
			<slot />
		</div>
	</div>
{/if}

<style lang="scss">
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
		backdrop-filter: blur(4px);
	}

	.modal {
		background: #181b21;
		border-radius: 12px;
		padding: 24px;
		color: #eee;
		width: 100%;
		max-width: 440px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}
</style>
