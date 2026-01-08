<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { fade } from "svelte/transition";
	import ExtensionGuide from "../ExtensionGuide.svelte";

	const dispatch = createEventDispatcher();
</script>

<div class="overlay-container" transition:fade={{ duration: 200 }}>
	<div class="modal-card">
		<div class="icon">🚧</div>
		<h2>You need to install an extension!</h2>
		<p>To play this video, you need to unblock browser restrictions.<br />Sorry for the inconvenience.</p>

		<div class="cors-info">
			<div class="info-content">
				<span class="badge">Why?</span>
				<span
					>The video server blocks external players (CORS).<br />This extension (CORS Unblock)
					<strong>removes that block</strong>.</span
				>
				<br /><br />
				Actually, I can do that for you (It's called proxy), but it would cost on my end. So that's not an option.
			</div>
		</div>

		<ExtensionGuide />

		<button class="retry-btn" on:click={() => dispatch("retry")}> ↻ I'm ready, Retry </button>
	</div>
</div>

<style lang="scss">
	.overlay-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(8px);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 50;
		padding: 1rem;
	}

	.modal-card {
		background: #181b21;
		border: 1px solid rgba(255, 165, 0, 0.3);
		padding: 2rem;
		border-radius: 16px;
		text-align: center;
		max-width: 550px;
		width: 100%;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);

		.icon {
			font-size: 2.5rem;
			margin-bottom: 0.5rem;
		}

		h2 {
			color: #ffb74d;
			margin: 0 0 0.5rem;
			font-size: 1.4rem;
		}

		p {
			color: #b9bbbe;
			margin-bottom: 1rem;
			font-size: 0.95rem;
		}

		.cors-info {
			background: rgba(88, 101, 242, 0.1);
			border: 1px solid rgba(88, 101, 242, 0.3);
			border-radius: 8px;
			padding: 0.8rem;
			margin-bottom: 1.5rem;
			font-size: 0.85rem;
			color: #dcddde;
			display: block; /* changed from flex to handle content better */
			text-align: center;

			.info-content {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.8rem;
				justify-content: center;
			}

			.badge {
				background: #5865f2;
				color: white;
				font-weight: bold;
				padding: 0.2rem 0.5rem;
				border-radius: 4px;
				font-size: 0.75rem;
				text-transform: uppercase;
			}
		}

		.retry-btn {
			background: #5865f2;
			color: white;
			border: none;
			padding: 0.8rem 2rem;
			border-radius: 8px;
			font-size: 1rem;
			font-weight: bold;
			cursor: pointer;
			transition: background 0.2s;

			&:hover {
				background: #4752c4;
			}
		}
	}
</style>
