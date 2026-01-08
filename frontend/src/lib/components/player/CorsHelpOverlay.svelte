<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { fade } from "svelte/transition";

	const dispatch = createEventDispatcher();
</script>

<div class="overlay-container" transition:fade={{ duration: 200 }}>
	<div class="modal-card">
		<div class="icon">🚧</div>
		<h2>Video Blocked (CORS)</h2>
		<p>
			This video cannot be played directly because the source website blocks external players. <br />
			To fix this, please install <strong>"CORS Unblock"</strong> to allow the browser to load the video.
		</p>

		<div class="extension-links">
			<a
				href="https://chromewebstore.google.com/detail/cors-unblock/lfhmikememgdcahcdlaciloancbhjino"
				target="_blank"
				class="ext-btn chrome"
			>
				<img
					src="https://upload.wikimedia.org/wikipedia/commons/e/e1/Google_Chrome_icon_%28February_2022%29.svg"
					alt="Chrome"
				/>
				Chrome / Edge
			</a>
			<a
				href="https://addons.mozilla.org/en-US/firefox/addon/cors-unblock/"
				target="_blank"
				class="ext-btn firefox"
			>
				<img
					src="https://upload.wikimedia.org/wikipedia/commons/a/a0/Firefox_logo%2C_2019.svg"
					alt="Firefox"
				/>
				Firefox
			</a>
		</div>

		<div class="help-text">
			<small>
				* Click the extension icon to <strong>activate it (turn it colored)</strong> before clicking Retry.<br
				/>
				Please disable it after using this site.
			</small>
		</div>

		<button class="retry-btn" on:click={() => dispatch("retry")}> ↻ I installed it, Retry </button>
	</div>
</div>

<style lang="scss">
	.overlay-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.85);
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
		max-width: 450px;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);

		.icon {
			font-size: 3rem;
			margin-bottom: 1rem;
		}

		h2 {
			color: #ffb74d;
			margin: 0 0 1rem;
			font-size: 1.5rem;
		}

		p {
			color: #b9bbbe;
			margin-bottom: 1.5rem;
			line-height: 1.5;
		}

		.extension-links {
			display: flex;
			gap: 1rem;
			justify-content: center;
			margin-bottom: 1.5rem;
			flex-wrap: wrap;

			.ext-btn {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				background: rgba(255, 255, 255, 0.08);
				padding: 0.6rem 1rem;
				border-radius: 8px;
				color: white;
				text-decoration: none;
				font-size: 0.9rem;
				font-weight: 600;
				border: 1px solid rgba(255, 255, 255, 0.1);
				transition: all 0.2s;

				img {
					width: 20px;
					height: 20px;
				}

				&:hover {
					background: rgba(255, 255, 255, 0.15);
					transform: translateY(-2px);
				}
			}
		}

		.help-text {
			margin-bottom: 1.5rem;
			color: #72767d;
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
