<script lang="ts">
	import { roomState, setUrl, currentRoomId } from "../stores/socket";

	let inputUrl = "";
	let refererUrl = "";
	let showCopied = false;

	$: if ($roomState) {
		if ($roomState.videoUrl) inputUrl = $roomState.videoUrl;
		if ($roomState.referer) refererUrl = $roomState.referer;
	}

	function handleLoad() {
		if ($currentRoomId) {
			setUrl($currentRoomId, inputUrl, refererUrl);
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
		<input type="text" bind:value={inputUrl} placeholder="Video URL (.m3u8 / .txt)" />
		<input type="text" bind:value={refererUrl} placeholder="Referer URL (Optional)" />
		<button class="load-btn" on:click={handleLoad}>Load</button>
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
