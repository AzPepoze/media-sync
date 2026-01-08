<script lang="ts">
	import { roomState, setUrl, currentRoomId, isVideoChanging } from "../stores/socket";

	let inputUrl = "";
	let refererUrl = "";
	let isLoading = false;

	let lastServerUrl: string | null = null;
	let lastServerReferer: string | null = null;

	$: if ($roomState) {
		if ($roomState.videoUrl !== lastServerUrl) {
			inputUrl = $roomState.videoUrl || "";
			lastServerUrl = $roomState.videoUrl;
			isLoading = false;
		}
		if ($roomState.referer !== lastServerReferer) {
			refererUrl = $roomState.referer || "";
			lastServerReferer = $roomState.referer;
		}
	}

	function handleLoad() {
		if ($currentRoomId && inputUrl.trim()) {
			isLoading = true;
			isVideoChanging.set(true); // Instant feedback locally
			setUrl($currentRoomId, inputUrl.trim(), refererUrl.trim());
			// Security fallback: if backend fails to respond, reset loading after 15s
			setTimeout(() => {
				isLoading = false;
				isVideoChanging.set(false);
			}, 15000);
		}
	}

	function handleClear() {
		inputUrl = "";
		refererUrl = "";
	}
</script>

<div class="url-control-panel">
	<div class="input-row">
		<div class="inputs-group">
			<input
				type="text"
				bind:value={inputUrl}
				placeholder="Video URL (youtube link / .m3u8 / .txt / any other playable media)"
			/>
			<input type="text" bind:value={refererUrl} placeholder="Referer URL (Optional)" />
		</div>
		<div class="actions-group">
			<button class="clear-btn" on:click={handleClear} title="Clear inputs"> Clear </button>
			<button class="load-btn" on:click={handleLoad} disabled={isLoading}>
				{isLoading ? "Loading..." : "Load"}
			</button>
		</div>
	</div>
</div>

<style lang="scss">
	$bg-panel: #181b21;
	$primary: #5865f2;
	$text-muted: #b9bbbe;

	.url-control-panel {
		margin-top: 1rem;
		background: $bg-panel;
		padding: 1rem;
		border-radius: 8px;

		.input-row {
			display: flex;
			gap: 10px;

			@media (max-width: 768px) {
				flex-direction: column;
			}

			.inputs-group {
				display: flex;
				flex: 1;
				gap: 10px;

				@media (max-width: 768px) {
					flex-direction: column;
				}

				input {
					flex: 1;
					padding: 0.8rem;
					background: #0f1115;
					border: 1px solid #333;
					color: white;
					border-radius: 6px;
					font-size: 0.9rem;
					&:focus {
						border-color: $primary;
						outline: none;
					}
				}
			}

			.actions-group {
				display: flex;
				gap: 10px;

				@media (max-width: 768px) {
					width: 100%;
				}

				button {
					padding: 0.8rem 1.5rem;
					border: none;
					border-radius: 6px;
					font-weight: bold;
					cursor: pointer;
					transition: all 0.2s;
					font-size: 1rem;

					@media (max-width: 768px) {
						flex: 1;
						padding: 1rem;
						min-height: 50px;
					}

					&:hover {
						filter: brightness(1.1);
					}

					&:active {
						transform: scale(0.98);
					}
				}

				.clear-btn {
					background: #2f3136;
					color: #dcddde;
					&:hover {
						background: #4f545c;
						color: white;
					}
				}

				.load-btn {
					background: $primary;
					color: white;
					min-width: 100px;
					&:disabled {
						opacity: 0.5;
						cursor: not-allowed;
					}
				}
			}
		}
	}
</style>
