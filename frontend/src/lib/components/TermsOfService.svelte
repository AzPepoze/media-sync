<script lang="ts">
	import { onMount } from "svelte";
	import { fade, scale } from "svelte/transition";

	export let onAccept: () => void;

	let visible = false;

	onMount(() => {
		const accepted = localStorage.getItem("tos_accepted");
		if (!accepted) {
			visible = true;
		} else {
			onAccept();
		}
	});

	function accept() {
		localStorage.setItem("tos_accepted", "true");
		visible = false;
		onAccept();
	}
</script>

{#if visible}
	<div class="tos-overlay" transition:fade={{ duration: 200 }}>
		<div class="tos-modal" transition:scale={{ duration: 300, start: 0.9 }}>
			<div class="tos-header">
				<div class="icon">⚖️</div>
				<h2>Terms of Service</h2>
			</div>

			<div class="tos-content">
				<p>Welcome to <strong>Media Sync</strong>. Please read and accept our terms before you continue:</p>

				<ul>
					<li>
						<strong>Purpose:</strong> Media Sync is a tool designed solely for
						<strong>Synchronized Video Playback</strong>, allowing users to watch videos together in
						real-time.
					</li>
					<li>
						<strong>Disclaimer:</strong> The developer <strong>has no affiliation</strong> with the video
						content played through this system, whether from YouTube, Twitch, or any other external sources.
					</li>
					<li>
						<strong>User Responsibility:</strong> Users are solely responsible for the content they choose
						to play and must comply with copyright laws and the terms of the respective video platforms.
					</li>
				</ul>

				<p class="disclaimer-box">
					By clicking the button below, you acknowledge that this system is merely a "video player" that
					synchronizes playback time.
				</p>
			</div>

			<div class="tos-actions">
				<button class="accept-btn" on:click={accept}> I understand and accept the terms </button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	:global(body) {
		overflow: hidden;
	}

	* {
		box-sizing: border-box;
	}

	.tos-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(8px);
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.tos-modal {
		background: #181b21;
		width: 100%;
		max-width: 500px;
		max-height: 85vh;
		border-radius: 20px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
	}

	.tos-header {
		flex-shrink: 0;
		padding: 2rem 2rem 1rem;
		text-align: center;

		.icon {
			font-size: 3rem;
			margin-bottom: 0.5rem;
		}

		h2 {
			margin: 0;
			color: #fff;
			font-size: 1.5rem;
			font-weight: 800;
		}
	}

	.tos-content {
		flex: 1;
		overflow-y: auto;
		padding: 0 2rem;
		color: #b9bbbe;
		line-height: 1.6;
		font-size: 0.95rem;

		&::-webkit-scrollbar {
			width: 6px;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: rgba(255, 255, 255, 0.1);
			border-radius: 10px;
		}

		p {
			margin-bottom: 1rem;
		}

		strong {
			color: #fff;
		}

		ul {
			padding-left: 1.2rem;
			margin-bottom: 1.5rem;

			li {
				margin-bottom: 0.8rem;
				&::marker {
					color: #5865f2;
				}
			}
		}

		.disclaimer-box {
			background: rgba(88, 101, 242, 0.1);
			border: 1px solid rgba(88, 101, 242, 0.2);
			padding: 1rem;
			border-radius: 12px;
			color: #e0e0e0;
			font-size: 0.9rem;
			text-align: center;
			font-style: italic;
			margin-bottom: 1.5rem;
		}
	}

	.tos-actions {
		flex-shrink: 0;
		padding: 1.5rem 2rem 2rem;
		background: #181b21;
		border-top: 1px solid rgba(255, 255, 255, 0.05);

		.accept-btn {
			width: 100%;
			padding: 1rem;
			background: #5865f2;
			color: white;
			border: none;
			border-radius: 12px;
			font-size: 1.1rem;
			font-weight: 700;
			cursor: pointer;
			transition: all 0.2s;

			&:hover {
				background: #4752c4;
				transform: translateY(-2px);
				box-shadow: 0 8px 20px rgba(88, 101, 242, 0.4);
			}

			&:active {
				transform: translateY(0);
			}
		}
	}

	@media (max-width: 480px) {
		.tos-overlay {
			padding: 10px;
		}

		.tos-modal {
			width: 100%;
			max-width: 100%;
			max-height: 90vh;
			border-radius: 20px;
		}

		.tos-header {
			padding: 1.5rem 1.5rem 0.5rem;
			h2 {
				font-size: 1.25rem;
			}
			.icon {
				font-size: 2.5rem;
			}
		}

		.tos-content {
			padding: 0 1.5rem;
			font-size: 0.85rem;
		}

		.tos-actions {
			padding: 1rem 1.5rem 1.5rem;
		}
	}
</style>
