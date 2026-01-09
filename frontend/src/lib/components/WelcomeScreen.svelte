<script lang="ts">
	import { onMount } from "svelte";
	import { fade, fly } from "svelte/transition";
	import BackgroundManager from "./welcome/BackgroundManager.svelte";
	import InfoSection from "./welcome/InfoSection.svelte";
	import LoginForm from "./welcome/LoginForm.svelte";

	let mounted = false;
	onMount(() => {
		mounted = true;
	});
</script>

<div class="welcome-wrapper">
	<div class="login-container">
		<!-- Background Layer Managed by Component -->
		<BackgroundManager />

		{#if mounted}
			<div class="hero-content">
				<!-- Left Side: Brand -->
				<div class="brand-section">
					<div class="brand-content" in:fly={{ x: -50, duration: 1000, delay: 200 }} out:fade>
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
					<div in:fly={{ x: 50, duration: 1000, delay: 400 }} out:fade>
						<LoginForm />
					</div>
				</div>
			</div>

			<div class="scroll-hint" in:fade={{ delay: 1500 }}>
				<span>How it works & Features</span>
				<div class="arrow">↓</div>
			</div>
		{/if}
	</div>

	<!-- Info Section (Features, About, etc.) -->
	<InfoSection />
</div>

<style lang="scss">
	/* Ensure padding doesn't overflow width */
	* {
		box-sizing: border-box;
	}

	$bg-dark: #0f1115;
	$primary: #5865f2;

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

	@keyframes bounce {
		0%,
		20%,
		50%,
		80%,
		100% {
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
			display: none;
		}

		.form-section {
			padding: 1rem;
			width: 100%;
			max-width: 100%;
		}
	}
</style>
