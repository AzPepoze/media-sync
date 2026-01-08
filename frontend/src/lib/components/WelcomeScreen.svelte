<script lang="ts">
	import { onMount } from "svelte";
	import { joinRoom, SERVER_URL } from "../stores/socket";

	let nickname = "";
	let roomId = "";

	// Background state
	let backgroundUrl = "";
	let backgroundPostId = "";
	let backgroundAuthor = "";
	let backgroundSource = "";
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
			const targetUrl = `https://konachan.net/post.json?limit=1&tags=order:random+rating:safe`;
			const proxyUrl = `https://proxy.azpepoze.com/?url=${encodeURIComponent(targetUrl)}`;
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
						backgroundPostId = post.id;
						backgroundAuthor = post.author;
						backgroundSource = post.source;
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

	async function generateRandomId() {
		let isUnique = false;
		let newId = "";
		let attempts = 0;

		while (!isUnique && attempts < 10) {
			newId = Math.random().toString(36).substring(2, 8);
			try {
				const apiUrl = `${SERVER_URL}/check-room/${newId}`;

				const res = await fetch(apiUrl);
				const data = await res.json();
				if (!data.exists) {
					isUnique = true;
				}
			} catch (e) {
				isUnique = true;
			}
			attempts++;
		}
		roomId = newId;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Enter" && nickname.trim()) {
			handleJoin();
		}
	}
</script>

<div class="welcome-wrapper">
	<div class="login-container">
		<!-- Fullscreen Background Layer -->
		<div
			class="background-layer"
			class:visible={isBgReady}
			style={backgroundUrl ? `background-image: url('${backgroundUrl}');` : ""}
		></div>

		<div class="hero-content">
			<!-- Left Side: Brand -->
			<div class="brand-section">
				<div class="brand-content">
					<img src="/logo.png" alt="Media Sync Logo" class="brand-logo" />
					<h1>Play Video Together in Real-Time Sync</h1>
					<p class="tagline">
						Media Sync lets you watch <strong>YouTube, Twitch, HLS, and direct video files</strong> with
						friends perfectly synced.
					</p>
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
							<button class="random-btn" on:click={generateRandomId} title="Generate random ID">
								🎲
							</button>
						</div>
					</div>

					<div class="actions">
						<button class="join-btn" on:click={handleJoin} disabled={!nickname}>
							{roomId ? "Join / Create Room" : "Create Random Room"}
						</button>
					</div>
				</div>
			</div>
		</div>

		<div class="scroll-hint">
			<span>How it works & Features</span>
			<div class="arrow">↓</div>
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
					<a href={backgroundSource} target="_blank" class="download-link">Go to source</a>
				{/if}
			</div>
		{/if}
	</div>

	<div class="about-section">
		<div class="about-container">
			<!-- How It Works Section -->
			<div class="how-it-works">
				<h2>How it works</h2>
				<div class="steps-grid">
					<div class="step-card">
						<div class="step-number">1</div>
						<h3>Create a Room</h3>
						<p>Enter a unique Room ID or let us generate one for you. No account needed.</p>
					</div>
					<div class="step-card">
						<div class="step-number">2</div>
						<h3>Paste Any Link</h3>
						<p>
							Paste a <strong>video link or even a webpage URL</strong>. We will try to find the
							video and play it for you.
						</p>
					</div>
					<div class="step-card">
						<div class="step-number">3</div>
						<h3>Play Together</h3>
						<p>
							Share the Room ID with friends and watch detected videos perfectly synced in
							real-time.
						</p>
					</div>
				</div>
			</div>

			<!-- Features Grid -->
			<div class="about-grid">
				<div class="about-card">
					<div class="icon">🚀</div>
					<h3>Real-time Sync</h3>
					<p>
						Experience seamless <strong>video playback with friends</strong>. Pause, seek, and play
						are synchronized instantly for everyone to <strong>watch together</strong>.
					</p>
				</div>
				<div class="about-card">
					<div class="icon">🔍</div>
					<h3>Smart Media Detection</h3>
					<p>
						Full support for <strong>YouTube, Twitch, HLS, and custom files</strong>. You can even
						paste a <strong>webpage link</strong>, and our backend will attempt to find the video
						source for you automatically.
					</p>
				</div>
				<div class="about-card">
					<div class="icon">💬</div>
					<h3>Private Watch Party</h3>
					<p>
						Create your own private space. Just share the Room ID to start your <strong
							>online watch party</strong
						> in seconds.
					</p>
				</div>
			</div>

						<div class="project-info">

							<h2>About Media Sync</h2>

							<p>

								Media Sync is an open-source project designed to bring people together through shared media experiences. 

								Built with modern technologies, it provides a lightweight 

								and responsive interface for <strong>synchronized video watching</strong>.

							</p>

							<div class="tech-stack">

								<span>SvelteKit</span>

								<span>TypeScript</span>

								<span>Socket.io</span>

								<span>Node.js</span>

								<span>Express</span>

								<span>Vite</span>

								<span>Sass</span>

								<span>HLS.js</span>

								<span>Playwright</span>

								<span>yt-dlp</span>

								<span>Docker</span>

								<span>pnpm</span>

							</div>

						</div>

					</div>

				</div>

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

			

				.welcome-wrapper {

					height: 100vh;

					height: 100dvh;

					overflow-y: auto;

					scroll-behavior: smooth;

					background-color: $bg-dark;

				}

			

				.login-container {

					display: flex;

					flex-direction: column;

					height: 100vh;

					height: 100dvh;

					width: 100%;

					overflow: hidden;

					position: relative;

			

					.background-layer {

						position: absolute;

						top: 0;

						left: 0;

						width: 100%;

						height: 100%;

						background-size: cover;

						background-position: center;

						opacity: 0;

						transition: opacity 1.2s ease-in-out;

						z-index: 0;

						&.visible {

							opacity: 1;

						}

					}

			

					&::after {

						content: "";

						position: absolute;

						top: 0;

						left: 0;

						width: 100%;

						height: 100%;

						background: rgba(0, 0, 0, 0.35);

						z-index: 0;

						pointer-events: none;

					}

				}

			

				.hero-content {

					flex: 1;

					display: flex;

					width: 100%;

					z-index: 1;

			

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

			

					@media (max-width: 768px) {

						display: none;

					}

			

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

							font-size: 3rem;

							font-weight: 800;

							margin: 0;

							color: white;

							text-shadow: 0 4px 15px rgba(0, 0, 0, 0.8);

							letter-spacing: -1px;

							max-width: 600px;

							line-height: 1.1;

						}

			

						.tagline {

							color: #e0e0e0;

							font-size: 1.2rem;

							margin: 1rem auto 0;

							max-width: 500px;

							line-height: 1.5;

							text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);

						}

					}

				}

			

				.form-section {

					flex: 1;

					display: flex;

					justify-content: center;

					align-items: center;

					padding: 2rem;

					background: transparent;

			

					.form-card {

						width: 100%;

						max-width: 420px;

						padding: 2.5rem;

						background: rgba(24, 27, 33, 0.85);

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

							text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);

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

								input {

									flex: 1;

								}

								.random-btn {

									background: rgba(32, 34, 37, 0.6);

									border: 1px solid rgba(255, 255, 255, 0.1);

									color: $text-main;

									padding: 0 1rem;

									border-radius: 10px;

									cursor: pointer;

									transition: all 0.2s;

									&:hover {

										background: rgba(64, 68, 75, 0.8);

									}

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

							&:disabled {

								opacity: 0.6;

								cursor: not-allowed;

							}

						}

					}

				}

			

				.scroll-hint {

					position: absolute;

					bottom: 2rem;

					left: 50%;

					transform: translateX(-50%);

					display: flex;

					flex-direction: column;

					align-items: center;

					color: white;

					z-index: 1;

					opacity: 0.7;

					font-size: 0.9rem;

					font-weight: 600;

					text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);

					pointer-events: none;

					animation: bounce 2s infinite;

			

					.arrow {

						font-size: 1.5rem;

						margin-top: 0.2rem;

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

							width: 12px;

							height: 12px;

							border: 2px solid rgba(255, 255, 255, 0.3);

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

						background: transparent;

						border: none;

						color: white;

						cursor: pointer;

						font-size: 1rem;

						opacity: 0.8;

						transition: transform 0.3s;

						&:hover {

							transform: rotate(180deg);

							opacity: 1;

						}

					}

					.download-link {

						color: lighten($primary, 15%);

						text-decoration: none;

						font-weight: bold;

						&:hover {

							text-decoration: underline;

						}

					}

				}

			

				.about-section {

					background-color: $bg-dark;

					padding: 6rem 2rem;

					position: relative;

					z-index: 2;

					border-top: 1px solid rgba(255, 255, 255, 0.05);

			

					.about-container {

						max-width: 1000px;

						margin: 0 auto;

					}

					

					.how-it-works {

						text-align: center;

						margin-bottom: 5rem;

						

						h2 {

							font-size: 2.5rem;

							color: white;

							margin-bottom: 3rem;

							font-weight: 800;

						}

			

						.steps-grid {

							display: grid;

							grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));

							gap: 2rem;

						}

			

						.step-card {

							background: rgba(255, 255, 255, 0.03);

							padding: 2rem;

							border-radius: 15px;

							border: 1px solid rgba(255, 255, 255, 0.05);

							transition: transform 0.3s;

							

							&:hover {

								transform: translateY(-5px);

								background: rgba(255, 255, 255, 0.05);

							}

			

							.step-number {

								background: linear-gradient(135deg, $primary, darken($primary, 10%));

								width: 40px;

								height: 40px;

								border-radius: 50%;

								display: flex;

								align-items: center;

								justify-content: center;

								font-weight: bold;

								font-size: 1.2rem;

								color: white;

								margin: 0 auto 1.5rem;

								box-shadow: 0 4px 10px rgba($primary, 0.4);

							}

							

							h3 {

								color: white;

								margin-bottom: 0.8rem;

								font-size: 1.3rem;

							}

							

							p {

								color: $text-muted;

								line-height: 1.5;

							}

						}

					}

			

					.about-grid {

						display: grid;

						grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));

						gap: 2rem;

						margin-bottom: 5rem;

					}

			

					.about-card {

						background: $bg-panel;

						padding: 2.5rem;

						border-radius: 20px;

						border: 1px solid rgba(255, 255, 255, 0.05);

						transition: transform 0.3s, border-color 0.3s;

			

						&:hover {

							transform: translateY(-5px);

							border-color: rgba($primary, 0.3);

						}

			

						.icon {

							font-size: 2.5rem;

							margin-bottom: 1.5rem;

						}

			

						h3 {

							font-size: 1.5rem;

							color: white;

							margin-bottom: 1rem;

						}

			

						p {

							color: $text-muted;

							line-height: 1.6;

							

							strong {

								color: lighten($primary, 10%);

								font-weight: 600;

							}

						}

					}

			

					.project-info {

						text-align: center;

						background: linear-gradient(145deg, rgba($primary, 0.1), transparent);

						padding: 4rem;

						border-radius: 30px;

						border: 1px solid rgba($primary, 0.1);

			

						h2 {

							font-size: 2.5rem;

							color: white;

							margin-bottom: 1.5rem;

						}

			

						p {

							color: $text-muted;

							font-size: 1.1rem;

							line-height: 1.8;

							max-width: 800px;

							margin: 0 auto 2.5rem;

							

							strong {

								color: white;

							}

						}

			

						.tech-stack {

							display: flex;

							flex-wrap: wrap;

							justify-content: center;

							gap: 1rem;

			

							span {

								background: rgba(255, 255, 255, 0.05);

								color: white;

								padding: 0.5rem 1.2rem;

								border-radius: 100px;

								font-size: 0.9rem;

								font-weight: 600;

								border: 1px solid rgba(255, 255, 255, 0.1);

							}

						}

					}

				}

			

				@keyframes spin {

					to {

						transform: rotate(360deg);

					}

				}

			

				@keyframes bounce {

					0%, 20%, 50%, 80%, 100% {

						transform: translateX(-50%) translateY(0);

					}

					40% {

						transform: translateX(-50%) translateY(-10px);

					}

					60% {

						transform: translateX(-50%) translateY(-5px);

					}

				}

			

				@media (max-width: 768px) {

					.brand-section {

						display: flex;

						flex: 0 0 auto;

						padding: 3rem 0 1rem;

						

						h1 {

							font-size: 2.5rem;

						}

						.brand-logo {

							width: 100px;

						}

						.tagline {

							display: none;

						}

					}

					.form-section {

						padding: 1rem;

					}

					.about-section {

						padding: 4rem 1.5rem;

						

						.project-info {

							padding: 2rem 1rem;

							h2 { font-size: 1.8rem; }

						}

					}

				}

			</style>
