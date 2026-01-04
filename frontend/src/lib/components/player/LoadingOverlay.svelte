<script lang="ts">
	import { fade } from "svelte/transition";
	export let isVideoChanging = false;
	export let localIsBuffering = false;
</script>

<div class="loading-overlay" transition:fade={{ duration: 200 }}>
	<div class="spinner"></div>
	<p>
		{#if isVideoChanging}
			Changing video...
		{:else if localIsBuffering}
			Loading...
		{:else}
			Waiting for others...
		{/if}
	</p>
</div>

<style lang="scss">
	$primary: #5865f2;
	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 10;
		pointer-events: none;
		color: white;
		.spinner {
			width: 48px;
			height: 48px;
			border: 4px solid rgba(255, 255, 255, 0.1);
			border-top-color: $primary;
			border-radius: 50%;
			animation: spin 0.8s linear infinite;
			margin-bottom: 1.25rem;
			filter: drop-shadow(0 0 10px rgba($primary, 0.4));
		}
		p {
			font-size: 1.1rem;
			font-weight: 600;
			letter-spacing: 0.5px;
			text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
		}
	}
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
