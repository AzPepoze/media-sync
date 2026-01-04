<script lang="ts">
	import { fade } from "svelte/transition";
	export let errorMessage = "";
	export let onRetry: () => void;
</script>

<div class="error-overlay" transition:fade={{ duration: 200 }}>
	<div class="error-card">
		<div class="error-icon">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path
					d="M12 9v4"
				/><path d="M12 17h.01" /></svg
			>
		</div>
		<h3>Playback Error</h3>
		<p>{errorMessage}</p>
		<button class="retry-btn" on:click={onRetry}> Try Again </button>
	</div>
</div>

<style lang="scss">
	$primary: #5865f2;
	.error-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 20;
		padding: 2rem;
		.error-card {
			background: rgba(24, 27, 33, 0.95);
			border: 1px solid rgba(255, 255, 255, 0.1);
			border-radius: 20px;
			padding: 2.5rem;
			width: 100%;
			max-width: 360px;
			text-align: center;
			box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
			animation: fadeInScale 0.3s ease-out;
			.error-icon {
				color: #ff6b6b;
				margin-bottom: 1.25rem;
				display: flex;
				justify-content: center;
				filter: drop-shadow(0 0 10px rgba(#ff6b6b, 0.3));
			}
			h3 {
				color: white;
				margin: 0 0 0.5rem 0;
				font-size: 1.5rem;
				font-weight: 700;
			}
			p {
				color: #b9bbbe;
				margin: 0 0 2rem 0;
				font-size: 1rem;
				line-height: 1.5;
			}
			.retry-btn {
				background: $primary;
				color: white;
				border: none;
				padding: 0.8rem 1.5rem;
				border-radius: 10px;
				font-size: 1rem;
				font-weight: 700;
				cursor: pointer;
				transition: all 0.2s;
				width: 100%;
				&:hover {
					background: lighten($primary, 5%);
					transform: translateY(-2px);
					box-shadow: 0 8px 20px rgba($primary, 0.4);
				}
				&:active {
					transform: translateY(0);
				}
			}
		}
	}
	@keyframes fadeInScale {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
