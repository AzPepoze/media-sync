<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { fade } from "svelte/transition";
	import ExtensionGuide from "../ExtensionGuide.svelte";

	const dispatch = createEventDispatcher<{
		retry: void;
		useProxy: void;
	}>();

	let showExtensionGuide = false;
</script>

<div class="overlay-container" transition:fade={{ duration: 200 }}>
	<div class="modal-card">
		<div class="icon">🚧</div>
		<h2>CORS Issue Detected</h2>

		<div class="why-section">
			<h3>Why is this happening?</h3>
			<p class="explanation">
				CORS (Cross-Origin Resource Sharing) is a security feature that prevents websites from accessing
				resources from other domains. The video server you're trying to watch from doesn't allow external
				players like mine to access its content directly. This is a browser security restriction, not a
				limitation of my app.
			</p>
		</div>

		<p class="choose-text">Choose how you want to proceed:</p>

		<div class="options">
			<div class="option option-recommended">
				<div class="option-header">
					<span class="badge recommended">Recommended for Desktop</span>
				</div>
				<h3>🧩 Use Browser Extension</h3>
				<p>Install the CORS Unblock extension to bypass restrictions directly in your browser.</p>
				<ul class="pros">
					<li>✓ Direct streaming (Like you watching from the original site)</li>
					<li>✓ Works for all videos</li>
				</ul>
				<button
					class="option-btn extension-btn"
					on:click={() => (showExtensionGuide = !showExtensionGuide)}
				>
					{showExtensionGuide ? "Hide Guide" : "Show Extension Guide"}
				</button>

				<button class="retry-btn" on:click={() => dispatch("retry")}> ↻ I've installed it, Retry </button>
			</div>

			<div class="divider">
				<span>OR</span>
			</div>

			<div class="option option-proxy">
				<div class="option-header">
					<span class="badge mobile">It's ok to use this</span>
				</div>
				<h3>🔄 Use my proxy server</h3>
				<p>Route video through my server to bypass CORS.</p>
				<ul class="cons">
					<li>⚠ Uses my server bandwidth</li>
					<li>⚠ May be slower</li>
				</ul>
				<button class="option-btn proxy-btn" on:click={() => dispatch("useProxy")}> Use Proxy Mode </button>
			</div>
		</div>
	</div>
</div>

{#if showExtensionGuide}
	<div class="overlay-container" transition:fade={{ duration: 150 }}>
		<div class="modal-card">
			<div class="extension-guide-header">
				<button class="back-btn" on:click={() => (showExtensionGuide = false)}> ← Back </button>
				<h2>Extension Installation Guide</h2>
			</div>
			<ExtensionGuide />
			<button class="ready-btn" on:click={() => dispatch("retry")}> ✓ I'm Ready, Let's Go! </button>
		</div>
	</div>
{/if}

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
		overflow-y: auto;
	}

	.modal-card {
		background: #181b21;
		border: 1px solid rgba(255, 165, 0, 0.3);
		padding: 1.5rem;
		border-radius: 16px;
		text-align: center;
		max-width: 1000px;

		h2 {
			color: #ffb74d;
			margin: 0 0 1rem;
			font-size: 1.4rem;
		}

		h3 {
			color: #fff;
			margin: 0 0 0.5rem;
			font-size: 1.1rem;
		}

		p {
			color: #b9bbbe;
			margin-bottom: 1rem;
			font-size: 0.95rem;
		}
	}

	.why-section {
		background: rgba(255, 165, 0, 0.1);
		border: 1px solid rgba(255, 165, 0, 0.2);
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1.5rem;
		text-align: left;

		h3 {
			color: #ffb74d;
			margin: 0 0 0.5rem;
			font-size: 1rem;
		}

		.explanation {
			color: #d4d6d8;
			font-size: 0.9rem;
			line-height: 1.5;
			margin: 0;
		}
	}

	.choose-text {
		font-weight: 500;
		color: #fff;
		margin-bottom: 1rem;
		color: #ffb74d;
		margin: 0 0 0.5rem;
		font-size: 1.4rem;

		p {
			color: #b9bbbe;
			margin-bottom: 1rem;
			font-size: 0.95rem;
		}
	}

	.options {
		display: flex;
		flex-direction: row;
		gap: 1rem;
	}

	.option {
		background: rgba(255, 255, 255, 0.03);
		border-radius: 12px;
		padding: 1rem;
		text-align: left;

		.option-header {
			margin-bottom: 0.5rem;
		}

		h3 {
			color: #fff;
			margin: 0 0 0.5rem;
			font-size: 1.1rem;
		}

		p {
			color: #b9bbbe;
			font-size: 0.85rem;
			margin: 0 0 0.75rem;
		}

		ul {
			list-style: none;
			padding: 0;
			margin: 0 0 1rem;
			font-size: 0.8rem;

			li {
				padding: 0.2rem 0;
			}
		}

		ul.pros li {
			color: #43b581;
		}

		ul.cons li {
			color: #faa61a;
		}
	}

	.option-recommended {
		border: 1px solid rgba(67, 181, 129, 0.4);
	}

	.option-proxy {
		border: 1px solid rgba(250, 166, 26, 0.3);
	}

	.badge {
		display: inline-block;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: bold;
		text-transform: uppercase;

		&.recommended {
			background: #43b581;
			color: white;
		}

		&.mobile {
			background: #faa61a;
			color: #000;
		}
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: #72767d;
		font-size: 0.8rem;

		&::before,
		&::after {
			content: "";
			flex: 1;
			height: 1px;
			background: rgba(255, 255, 255, 0.1);
		}
	}

	.option-btn {
		width: 100%;
		padding: 0.6rem 1rem;
		border: none;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		margin-bottom: 0.5rem;

		&.extension-btn {
			background: rgba(88, 101, 242, 0.2);
			color: #7289da;
			border: 1px solid rgba(88, 101, 242, 0.4);

			&:hover {
				background: rgba(88, 101, 242, 0.3);
			}
		}

		&.proxy-btn {
			background: rgba(250, 166, 26, 0.2);
			color: #faa61a;
			border: 1px solid rgba(250, 166, 26, 0.4);

			&:hover {
				background: rgba(250, 166, 26, 0.3);
			}
		}
	}

	.retry-btn {
		width: 100%;
		background: #43b581;
		color: white;
		border: none;
		padding: 0.7rem 1rem;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: bold;
		cursor: pointer;
		transition: background 0.2s;

		&:hover {
			background: #3ca374;
		}
	}

	.extension-guide-wrapper {
		margin: 1rem 0;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 8px;
	}

	.extension-guide-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
		position: relative;

		h2 {
			flex: 1;
			text-align: center;
			margin: 0;
		}
	}

	.back-btn {
		background: rgba(255, 255, 255, 0.1);
		color: #b9bbbe;
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;

		&:hover {
			background: rgba(255, 255, 255, 0.15);
			color: #fff;
		}
	}

	.ready-btn {
		width: 100%;
		background: #43b581;
		color: white;
		border: none;
		padding: 0.8rem 1.5rem;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: bold;
		cursor: pointer;
		transition: background 0.2s;
		margin-top: 1rem;

		&:hover {
			background: #3ca374;
		}
	}
</style>
