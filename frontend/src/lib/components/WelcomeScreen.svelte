<script lang="ts">
	import { onMount } from "svelte";
	import { joinRoom } from "../stores/socket";

	let nickname = "";
	let roomId = "";

	// Background state
	let backgroundUrl = "";
	let backgroundPostId = "";
	let backgroundAuthor = "";
	let backgroundFileUrl = "";
	let isBgLoading = false;
	let isBgReady = false;

	onMount(() => {
		const savedNick = localStorage.getItem("nickname");
		if (savedNick) nickname = savedNick;

		const params = new URLSearchParams(window.location.search);
		const roomParam = params.get("room_id");
		if (roomParam) roomId = roomParam;

		fetchRandomBackground();
	});

	async function fetchRandomBackground() {
		isBgLoading = true;
		try {
			const targetUrl = `https://konachan.net/post.json?limit=1&tags=order:random+rating:safe&_t=${Date.now()}`;
			const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
			const res = await fetch(proxyUrl);
			const data = await res.json();
			
			if (data && data.length > 0) {
				const post = data[0];
				const imgUrl = post.sample_url || post.file_url;
				
				const img = new Image();
				img.src = imgUrl;
				img.onload = () => {
					isBgReady = false;
					setTimeout(() => {
						backgroundUrl = imgUrl;
						backgroundFileUrl = post.file_url;
						backgroundPostId = post.id;
						backgroundAuthor = post.author;
						isBgReady = true;
						isBgLoading = false;
					}, 100);
				};
				img.onerror = () => {
					isBgLoading = false;
				};
			} else {
				isBgLoading = false;
			}
		} catch (e) {
			console.error("Failed to fetch background", e);
			isBgLoading = false;
		}
	}

	function handleJoin() {
		if (!nickname.trim()) return;

		if (!roomId.trim()) {
			roomId = Math.random().toString(36).substring(2, 8);
		}

		joinRoom(roomId, nickname);
	}

	function generateRandomId() {
		roomId = Math.random().toString(36).substring(2, 8);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Enter" && nickname.trim()) {
			handleJoin();
		}
	}
</script>

<div class="login-container">
	<!-- Fullscreen Background Layer -->
	<div 
		class="background-layer" 
		class:visible={isBgReady}
		style={backgroundUrl ? `background-image: url('${backgroundUrl}');` : ''}
	></div>

	<!-- Left Side: Brand -->
	<div class="brand-section">
		<div class="brand-content">
			<img src="/logo.png" alt="Media Sync Logo" class="brand-logo" />
			<h1>Media Sync</h1>
			<p class="tagline">Watch videos together with friends in real-time.</p>
		</div>
	</div>

	<!-- Right Side: Floating Form Card -->
	<div class="form-section">
		<div class="form-card">
			<h2>Welcome</h2>
			<p class="subtitle">Enter your name and room ID to start watching together</p>

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
				<div class="room-input-wrapper">
					<input
						id="room"
						type="text"
						bind:value={roomId}
						placeholder="Custom ID or leave blank for random"
						on:keydown={handleKeydown}
					/>
					<button class="random-btn" on:click={generateRandomId} title="Generate random ID"> 🎲 </button>
				</div>
			</div>

			<div class="actions">
				<button class="join-btn" on:click={handleJoin} disabled={!nickname}>
					{roomId ? "Join / Create Room" : "Create Random Room"}
				</button>
			</div>
		</div>
	</div>

	<!-- Credits & Loading UI -->
	{#if backgroundUrl || isBgLoading}
		<div class="bg-credits" class:loading={isBgLoading}>
			{#if isBgLoading}
				<div class="loading-state">
					<div class="spinner"></div>
					<span>Loading background...</span>
				</div>
			{:else}
				<div class="credit-row">
					<span class="source">Random background by Konachan</span>
					<button class="refresh-btn" on:click={fetchRandomBackground} title="Next Image">↻</button>
				</div>
				<a href={backgroundFileUrl} target="_blank" class="download-link">Download background</a>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	$bg-dark: #0f1115;
	$bg-panel: #181b21;
	$primary: #5865f2;
	$primary-hover: #4752c4;
	$secondary: #2f3136;
	$secondary-hover: #40444b;
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
		position: relative;

		.background-layer {
			position: absolute;
			top: 0; left: 0; width: 100%; height: 100%;
			background-size: cover;
			background-position: center;
			opacity: 0;
			transition: opacity 1.2s ease-in-out;
			z-index: 0;
			&.visible { opacity: 1; }
		}

		// Global dark overlay for contrast on the image
		&::after {
			content: "";
			position: absolute;
			top: 0; left: 0; width: 100%; height: 100%;
			background: rgba(0, 0, 0, 0.25);
			z-index: 0;
			pointer-events: none;
		}

		@media (max-width: 768px) {
			flex-direction: column;
		}
	}

	.brand-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		position: relative;
		z-index: 1;
		// Removed local background tint, relying on global overlay + text shadows

		.brand-content {
			text-align: center;
			padding: 2rem;

			.brand-logo {
				width: 160px;
				height: auto;
				margin-bottom: 1.5rem;
				filter: drop-shadow(0 0 20px rgba($primary, 0.6));
			}

			h1 {
				font-size: 3.5rem;
				font-weight: 800;
				margin: 0;
				color: white;
				text-shadow: 0 4px 15px rgba(0,0,0,0.8);
				letter-spacing: -1px;
			}

			.tagline {
				color: #e0e0e0;
				font-size: 1.2rem;
				margin-top: 1rem;
				max-width: 400px;
				line-height: 1.5;
				text-shadow: 0 2px 4px rgba(0,0,0,0.8);
			}
		}
	}

	.form-section {
		flex: 1;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 2rem;
		z-index: 1;
		background: transparent; // Transparent container

		.form-card {
			width: 100%;
			max-width: 420px;
			padding: 2.5rem;
			// Floating Glassmorphism Card
			background: rgba(24, 27, 33, 0.8); 
			backdrop-filter: blur(20px); 
			-webkit-backdrop-filter: blur(20px);
			border: 1px solid rgba(255, 255, 255, 0.1);
			border-radius: 20px;
			box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);

			h2 {
				font-size: 2rem;
				color: $text-main;
				margin-bottom: 0.5rem;
				font-weight: 700;
				text-shadow: 0 2px 4px rgba(0,0,0,0.5);
			}

			.subtitle {
				color: $text-muted;
				margin-bottom: 2.5rem;
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
				}
				input {
					width: 100%;
					padding: 1rem;
					background: rgba(32, 34, 37, 0.6);
					border: 1px solid rgba(255, 255, 255, 0.1);
					border-radius: 10px;
					color: $text-main;
					font-size: 1rem;
					box-sizing: border-box;
					transition: all 0.2s;
					&:focus {
						outline: none;
						border-color: $primary;
						background-color: rgba(32, 34, 37, 0.9);
					}
				}
				.room-input-wrapper {
					display: flex;
					gap: 0.5rem;
					input { flex: 1; }
					.random-btn {
						background: rgba(32, 34, 37, 0.6);
						border: 1px solid rgba(255, 255, 255, 0.1);
						color: $text-main;
						padding: 0 1rem;
						border-radius: 10px;
						cursor: pointer;
						transition: all 0.2s;
						&:hover { background: rgba(64, 68, 75, 0.8); }
					}
				}
			}

			.actions {
				margin-top: 1.5rem;
			}

			.join-btn {
				width: 100%;
				padding: 1rem;
				border: none;
				border-radius: 10px;
				font-size: 1.1rem;
				font-weight: 700;
				cursor: pointer;
				background: $primary;
				color: white;
				transition: all 0.2s;
				&:hover:not(:disabled) {
					background: $primary-hover;
					transform: translateY(-2px);
					box-shadow: 0 8px 20px rgba($primary, 0.4);
				}
				&:disabled { opacity: 0.6; cursor: not-allowed; }
			}
		}
	}

	.bg-credits {
		position: absolute;
		bottom: 1rem;
		left: 1rem;
		z-index: 10;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.8);
		background: rgba(0, 0, 0, 0.6);
		padding: 0.5rem 0.8rem;
		border-radius: 6px;
		backdrop-filter: blur(4px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		min-width: 120px;

		.loading-state {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.2rem 0;
			.spinner {
				width: 12px; height: 12px;
				border: 2px solid rgba(255,255,255,0.3);
				border-top-color: white;
				border-radius: 50%;
				animation: spin 0.8s linear infinite;
			}
		}
		.credit-row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}
		.refresh-btn {
			background: transparent; border: none; color: white; cursor: pointer;
			font-size: 1rem; opacity: 0.8;
			&:hover { transform: rotate(30deg); opacity: 1; }
		}
		.download-link {
			color: lighten($primary, 15%);
			text-decoration: none;
			font-weight: bold;
			&:hover { text-decoration: underline; }
		}
	}

	@keyframes spin { to { transform: rotate(360deg); } }
	@media (max-width: 768px) {
		.brand-section { flex: 0 0 auto; padding: 2rem 0; }
		.form-section { padding: 1rem; }
	}
</style>
