<script lang="ts">
	import { onMount } from "svelte";
	import { joinRoom } from "../stores/socket";

	let nickname = "";
	let roomId = "";

	onMount(() => {
		const savedNick = localStorage.getItem("nickname");
		if (savedNick) nickname = savedNick;
	});

	function handleJoin() {
		if (nickname.trim()) {
			joinRoom(roomId, nickname);
		}
	}
</script>

<div class="login-screen">
	<div class="card">
		<h1>🎬 Media Sync</h1>
		<p>Enter your nickname to join the room.</p>

		<div class="input-group">
			<label for="nick">Nickname</label>
			<input id="nick" type="text" bind:value={nickname} placeholder="Your Nickname" />
		</div>

		<div class="input-group">
			<label for="room">Room ID</label>
			<input id="room" type="text" bind:value={roomId} placeholder="ROOM id (Just set what ever you want)" />
		</div>

		<button class="join-btn" on:click={handleJoin} disabled={!nickname}> Join Room </button>
	</div>
</div>

<style lang="scss">
	$bg-dark: #0f1115;
	$bg-panel: #181b21;
	$primary: #5865f2;
	$text-muted: #b9bbbe;

	.login-screen {
		height: 100vh;
		display: flex;
		justify-content: center;
		align-items: center;
		background: radial-gradient(circle at center, #1e222a 0%, $bg-dark 100%);

		.card {
			background: $bg-panel;
			padding: 2.5rem;
			border-radius: 12px;
			box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
			width: 100%;
			max-width: 400px;
			text-align: center;

			h1 {
				margin-bottom: 1.5rem;
				font-size: 1.8rem;
				color: white;
			}
			p {
				color: $text-muted;
				margin-bottom: 2rem;
			}

			.input-group {
				margin-bottom: 1.5rem;
				text-align: left;
				label {
					display: block;
					margin-bottom: 0.5rem;
					color: $text-muted;
					font-size: 0.9rem;
				}
				input {
					width: 100%;
					padding: 0.8rem;
					background: #0f1115;
					border: 1px solid #333;
					border-radius: 6px;
					color: white;
					box-sizing: border-box;
					&:focus {
						outline: 2px solid $primary;
						border-color: transparent;
					}
				}
			}

			.join-btn {
				width: 100%;
				padding: 1rem;
				background: $primary;
				color: white;
				border: none;
				border-radius: 6px;
				font-weight: bold;
				cursor: pointer;
				transition: 0.2s;
				&:hover {
					background: lighten($primary, 5%);
				}
				&:disabled {
					background: #333;
					cursor: not-allowed;
				}
			}
		}
	}
</style>
