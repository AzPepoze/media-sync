<script lang="ts">
	import { fade } from "svelte/transition";
</script>

<div class="no-video-overlay" transition:fade={{ duration: 200 }}>
	<div class="no-video-icon">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="64"
			height="64"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" /><path
				d="M12 7v5l3 3"
			/></svg
		>
	</div>
	<h3>No video selected</h3>
	<p>Enter a URL in the bar below to start watching together</p>
</div>

<style lang="scss">
	$primary: #5865f2;
	.no-video-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: #0f1115;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 5;
		color: #b9bbbe;
		text-align: center;
		padding: 2rem;
		.no-video-icon {
			color: $primary;
			margin-bottom: 1.5rem;
			opacity: 0.6;
		}
		h3 {
			color: white;
			margin: 0 0 0.5rem 0;
			font-size: 1.5rem;
		}
		p {
			max-width: 300px;
			line-height: 1.4;
		}
	}
</style>
