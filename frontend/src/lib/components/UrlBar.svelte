<script lang="ts">
	import { roomState, setUrl, currentRoomId, isVideoChanging } from "../stores/socket";

	let inputUrl = "";
	let refererUrl = "";
	let showCopied = false;
	let isLoading = false;

	// Track last synced values to prevent overwriting user input on unrelated store updates
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
			setUrl($currentRoomId, inputUrl, refererUrl);
			// Security fallback: if backend fails to respond, reset loading after 15s
			setTimeout(() => { isLoading = false; isVideoChanging.set(false); }, 15000);
		}
	}

	function copyRoomId() {
		const inviteLink = `${window.location.origin}${window.location.pathname}?room_id=${$currentRoomId}`;
		navigator.clipboard.writeText(inviteLink);
		showCopied = true;
		setTimeout(() => (showCopied = false), 2000);
	}
</script>

<div class="url-control-panel">
	<div class="input-row">
		<input type="text" bind:value={inputUrl} placeholder="Video URL (mp4 / .m3u8 / .txt)" />
		<input type="text" bind:value={refererUrl} placeholder="Referer URL (Optional)" />
		<button class="load-btn" on:click={handleLoad} disabled={isLoading}>
			{isLoading ? "Loading..." : "Load"}
		</button>
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

			input {
				flex: 1;
				padding: 0.8rem;
				background: #0f1115;
				border: 1px solid #333;
				color: white;
				border-radius: 6px;
				&:focus {
					border-color: $primary;
					outline: none;
				}
			}
			.load-btn {
				padding: 0 1.5rem;
				background: $primary;
				color: white;
				border: none;
				border-radius: 6px;
				font-weight: bold;
				cursor: pointer;
				&:hover {
					filter: brightness(1.1);
				}
			}
		}
	}
</style>
