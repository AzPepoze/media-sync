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

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Enter" && nickname.trim()) {
			handleJoin();
		}
	}
</script>

<div class="login-container">
	<div class="brand-section">
		<div class="brand-content">
			<div class="logo-icon">🎬</div>
			<h1>Media Sync</h1>
			<p class="tagline">Watch videos together with friends in real-time.</p>
		</div>
	</div>

	<div class="form-section">
		<div class="form-card">
			<h2>:3</h2>
			<p class="subtitle">Enter your details to join a room</p>

			<div class="input-group">
				<label for="nick">Nickname</label>
				<input
					id="nick"
					type="text"
					bind:value={nickname}
					placeholder="Enter your nickname"
					on:keydown={handleKeydown}
				/>
			</div>

			<div class="input-group">
				<label for="room">Room ID</label>
				<input
					id="room"
					type="text"
					bind:value={roomId}
					placeholder="whatever id as you like"
					on:keydown={handleKeydown}
				/>
			</div>

			<button class="join-btn" on:click={handleJoin} disabled={!nickname}> Join Room </button>
		</div>
	</div>
</div>

<style lang="scss">
	$bg-dark: #0f1115;
	$bg-panel: #181b21;
	$primary: #5865f2;
	$primary-hover: #4752c4;
	$text-main: #ffffff;
	$text-muted: #b9bbbe;
	$input-bg: #202225;
	$border-color: #2f3136;

	.login-container {
		display: flex;
		height: 100vh;
		width: 100vw;
		background-color: $bg-dark;
		overflow: hidden;

		@media (max-width: 768px) {
			flex-direction: column;
		}
	}

	.brand-section {
		flex: 1;
		background: linear-gradient(135deg, #1e222a 0%, #0f1115 100%);
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		position: relative;
		overflow: hidden;
		border-right: 1px solid $border-color;

		// Decorative background element
		&::before {
			content: "";
			position: absolute;
			top: -50%;
			left: -50%;
			width: 200%;
			height: 200%;
			background: radial-gradient(circle, rgba($primary, 0.1) 0%, transparent 60%);
			animation: pulse 10s infinite alternate;
		}

		.brand-content {
			position: relative;
			z-index: 1;
			text-align: center;
			padding: 2rem;

			.logo-icon {
				font-size: 5rem;
				margin-bottom: 1rem;
				filter: drop-shadow(0 0 20px rgba($primary, 0.5));
			}

			h1 {
				font-size: 3.5rem;
				font-weight: 800;
				margin: 0;
				background: linear-gradient(to right, #fff, #b9bbbe);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				letter-spacing: -1px;
			}

			.tagline {
				color: $text-muted;
				font-size: 1.2rem;
				margin-top: 1rem;
				max-width: 400px;
				line-height: 1.5;
			}
		}

		@media (max-width: 768px) {
			flex: 0 0 30%;
			min-height: 200px;

			.brand-content {
				.logo-icon {
					font-size: 3rem;
				}
				h1 {
					font-size: 2rem;
				}
				.tagline {
					display: none;
				}
			}
		}
	}

	.form-section {
		flex: 1;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: $bg-dark;
		padding: 2rem;

		.form-card {
			width: 100%;
			max-width: 420px;
			padding: 2rem; // Added padding for spacing on smaller screens if needed, mostly redundant with flex align but good for safety.

			h2 {
				font-size: 2rem;
				color: $text-main;
				margin-bottom: 0.5rem;
				font-weight: 700;
			}

			.subtitle {
				color: $text-muted;
				margin-bottom: 3rem;
				font-size: 1rem;
			}

			.input-group {
				margin-bottom: 1.5rem;

				label {
					display: block;
					margin-bottom: 0.5rem;
					color: $text-muted;
					font-size: 0.85rem;
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: 0.5px;
				}

				input {
					width: 100%;
					padding: 1rem;
					background: $input-bg;
					border: 1px solid transparent;
					border-radius: 8px;
					color: $text-main;
					font-size: 1rem;
					transition: all 0.2s ease;
					box-sizing: border-box;

					&:focus {
						outline: none;
						border-color: $primary;
						background-color: lighten($input-bg, 2%);
						box-shadow: 0 0 0 4px rgba($primary, 0.1);
					}

					&::placeholder {
						color: darken($text-muted, 20%);
					}
				}
			}

			.join-btn {
				width: 100%;
				padding: 1rem;
				background: $primary;
				color: white;
				border: none;
				border-radius: 8px;
				font-size: 1rem;
				font-weight: 600;
				cursor: pointer;
				transition: all 0.2s ease;
				margin-top: 1rem;

				&:hover {
					background: $primary-hover;
					transform: translateY(-1px);
					box-shadow: 0 4px 12px rgba($primary, 0.3);
				}

				&:active {
					transform: translateY(0);
				}

				&:disabled {
					background: #36393f;
					color: #72767d;
					cursor: not-allowed;
					transform: none;
					box-shadow: none;
				}
			}
		}
	}

	@keyframes pulse {
		0% {
			opacity: 0.5;
			transform: scale(1);
		}
		100% {
			opacity: 0.8;
			transform: scale(1.1);
		}
	}
</style>
