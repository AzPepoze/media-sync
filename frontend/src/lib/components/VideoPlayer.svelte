<script lang="ts">
	import { tick } from "svelte";
	import {
		socket,
		roomState,
		isWaitingForOthers,
		isVideoChanging,
		roomError,
		emitAction,
		currentRoomId,
	} from "../stores/socket";
	// Utilities
	import { getYoutubeId, getProxyUrl, isHlsSource } from "../utils/media";
	import { HTML5Player, YouTubePlayer, type BasePlayer } from "../utils/players";
	import Hls from "hls.js";
	// Sub-components
	import SeekTooltip from "./player/SeekTooltip.svelte";
	import Controls from "./player/Controls.svelte";
	import LoadingOverlay from "./player/LoadingOverlay.svelte";
	import ErrorOverlay from "./player/ErrorOverlay.svelte";
	import NoVideoOverlay from "./player/NoVideoOverlay.svelte";
	import CorsHelpOverlay from "./player/CorsHelpOverlay.svelte";
	import YoutubeEmbed from "./player/YoutubeEmbed.svelte";

	// Elements & Refs
	let videoElement: HTMLVideoElement;
	let peekVideo: HTMLVideoElement;
	let ytComponent: YoutubeEmbed;

	// Player Strategy Instance
	let player: BasePlayer | null = null;
	let peekHls: Hls | null = null;

	// State Tracking
	let isYoutube = false;
	let currentLoadedUrl = "";
	let currentLoadedReferer = "";

	// Sync State
	let syncLockUntil = 0;
	let isRemoteSeeking = false;
	let isSyncing = false;
	let localIsBuffering = false;

	// Error State
	let hasError = false;
	let showCorsHelp = false;
	let errorMessage = "";
	let retryCount = 0;
	const MAX_RETRIES = 2;

	// UI State
	let currentTime = 0;
	let duration = 0;
	let buffered = 0;
	let volume = 1;
	let isMuted = false;
	let showControls = true;
	let hideCursor = false;
	let seekHoverTime = 0;
	let seekHoverPercent = 0;
	let isHoveringSeek = false;
	let controlsTimeout: ReturnType<typeof setTimeout>;

	//-------------------------------------------------------
	// Core Logic: Load Video
	//-------------------------------------------------------

	async function loadCurrentVideo() {
		if (!$roomState?.videoUrl) {
			emitAction("buffering_end", $currentRoomId);
			return;
		}

		localIsBuffering = true;
		const ytId = getYoutubeId($roomState.videoUrl);
		const isDirectLink =
			ytId ||
			isHlsSource($roomState.videoUrl) ||
			$roomState.videoUrl.match(/\.(mp4|webm|mkv|mov|avi|flv)(\?|$)/i) ||
			$roomState.videoUrl.includes("googlevideo.com");

		if (!isDirectLink) {
			console.log("[Player] URL format not supported or skipping.");
			return;
		}

		const stateReferer = $roomState.referer || "";
		let targetTime = $roomState.currentTime;

		// Compensation for latency
		if ($roomState.isPlaying && $roomState.lastUpdated) {
			const elapsed = (Date.now() - $roomState.lastUpdated) / 1000;
			targetTime += elapsed;
		}

		if ($roomState.videoUrl !== currentLoadedUrl || stateReferer !== currentLoadedReferer) {
			await loadVideo($roomState.videoUrl, stateReferer, targetTime, $roomState.isPlaying);
		} else {
			if (!player || !player.isReady) return;

			const currentPlayerTime = player.getCurrentTime();
			const diff = Math.abs(currentPlayerTime - targetTime);

			if (diff > 2) {
				console.log(`[Sync] Drift detected (${diff.toFixed(2)}s). Resyncing...`);
				player.seek(targetTime);
			}

			// Play/Pause State Sync
			const shouldBePlaying = $roomState.isPlaying && !$isWaitingForOthers;
			const isActuallyPlaying = player.isPlaying;

			// Only intervene if there is a mismatch AND we are not buffering locally
			if (shouldBePlaying && !isActuallyPlaying && !localIsBuffering) {
				console.log("[Sync] Resuming playback");
				player.play();
			} else if (!shouldBePlaying && isActuallyPlaying) {
				console.log("[Sync] Pausing playback (waiting or paused)");
				player.pause();
			}
		}
	}

	async function loadVideo(url: string, referer: string, startTime = 0, shouldPlay = false) {
		localIsBuffering = true;
		emitAction("buffering_start", $currentRoomId);

		// Reset States
		hasError = false;
		showCorsHelp = false;
		errorMessage = "";
		currentTime = startTime;
		buffered = 0;
		retryCount = 0;
		currentLoadedUrl = url;
		currentLoadedReferer = referer;

		const ytId = getYoutubeId(url);

		// Determine Player Type change
		const targetType = ytId ? "youtube" : "html5";

		// Cleanup if type mismatches
		if (player && player.type !== targetType) {
			player.destroy();
			player = null;
		}

		if (ytId) {
			isYoutube = true;
			await tick();

			if (!player && ytComponent) {
				player = new YouTubePlayer(ytComponent);
				player.setPlayingChangeCallback(() => {
					// Force reactivity update
					player = player;
				});
			}
		} else {
			isYoutube = false;
			await tick();

			if (!player) {
				player = new HTML5Player(videoElement, {
					onManifestParsed: () => {
						isVideoChanging.set(false);
					},
					onError: (type, details, fatal) => {
						if (details === "manifestLoadError" || details === "fragLoadError") {
							showCorsHelp = true;
							localIsBuffering = false;
							emitAction("buffering_end", $currentRoomId);
						} else if (fatal) {
							showError(`Video Error: ${details}`);
						}
					},
				});
				player.setPlayingChangeCallback(() => {
					// Force reactivity update
					player = player;
				});
			}

			// Load Content
			if (player instanceof HTML5Player) {
				await player.load(url, referer, startTime, shouldPlay);
			}
		}
	}

	//-------------------------------------------------------
	// Socket Listeners
	//-------------------------------------------------------
	$: if ($roomState) loadCurrentVideo();

	// React to waiting state changes
	$: if (player && player.isReady) {
		if ($isWaitingForOthers && player.isPlaying) {
			console.log("[Sync] Others buffering, pausing playback");
			player.pause();
		} else if (!$isWaitingForOthers && !localIsBuffering && $roomState.isPlaying && !player.isPlaying) {
			console.log("[Sync] Others ready, resuming playback");
			player.play();
		}
	}

	$: if ($socket) {
		$socket.off("connect");
		$socket.off("player_action");

		$socket.on("connect", () => {
			console.log("[Player] Socket connected, re-syncing...");
			currentLoadedUrl = "";
			loadCurrentVideo();
		});

		$socket.on("player_action", (data: { action: string; time: number }) => {
			if (!player) return;
			const playerTime = player.getCurrentTime();
			console.log("[Player] Action received:", data.action, "at", data.time);

			if (data.action === "seek") {
				if (Math.abs(playerTime - data.time) < 0.5) {
					return;
				}
				emitAction("buffering_start", $currentRoomId);
				isRemoteSeeking = true;
				localIsBuffering = true;

				player.seek(data.time);
				onSeeked();
				return;
			}

			// Sync time if drift is significant
			const diff = Math.abs(playerTime - data.time);
			if (diff > 0.5) {
				player.seek(data.time);
			}

			if (data.action === "play") {
				player.play();
			} else if (data.action === "pause") {
				player.pause();
			}
		});
	}

	//-------------------------------------------------------
	// Event Handlers
	//-------------------------------------------------------

	function onYoutubeReady(e: CustomEvent) {
		console.log("[Youtube] Ready");
		if (!player && ytComponent) {
			player = new YouTubePlayer(ytComponent);
			player.setPlayingChangeCallback(() => {
				// Force reactivity update
				player = player;
			});
		}
		isVideoChanging.set(false);
		duration = e.detail.duration;

		// Setup initial state
		localIsBuffering = false;
		emitAction("buffering_end", $currentRoomId);
	}

	function onYoutubeTimeUpdate(e: CustomEvent) {
		currentTime = e.detail.currentTime;
		duration = e.detail.duration;
		buffered = e.detail.buffered;
	}

	function onTimeUpdate() {
		if (isYoutube) return;
		currentTime = videoElement.currentTime;
		if (videoElement.buffered.length > 0) {
			buffered = (videoElement.buffered.end(videoElement.buffered.length - 1) / duration) * 100;
		}
	}

	function onPlay() {
		console.log("[Player] onPlay triggered");

		if (isYoutube && localIsBuffering) {
			console.log("[Youtube] Recovered from Buffering -> Playing");

			localIsBuffering = false;

			if ($roomState.isPlaying) {
				console.log("[Youtube] Auto-resume detected. Suppressing 'play' emit.");
				if (player) player.updatePlayingState(true);
				return;
			}
		}

		if (player) player.updatePlayingState(true);

		if (player && player.isPlaying) return;

		// Emit Play Action
		// Only if not waiting for others, not currently waiting for buffer, etc.
		if (!isRemoteSeeking && !$isWaitingForOthers && !localIsBuffering) {
			const t = player ? player.getCurrentTime() : 0;
			emitAction("play", { roomId: $currentRoomId, time: t });
		}
	}

	function onPause() {
		console.log("[Player] onPause triggered");

		if (player) player.updatePlayingState(false);

		if (player && !player.isPlaying) return;

		if (!isRemoteSeeking && !$isWaitingForOthers && !localIsBuffering) {
			const t = player ? player.getCurrentTime() : 0;
			emitAction("pause", { roomId: $currentRoomId, time: t });
		}
	}

	function onSeeked() {
		// if (localIsBuffering) {
		// 	localIsBuffering = false;
		// 	emitAction("buffering_end", $currentRoomId);
		// }
		if (isRemoteSeeking) {
			isRemoteSeeking = false;
			return;
		}

		const t = player ? player.getCurrentTime() : 0;
		emitAction("seek", { roomId: $currentRoomId, time: t });
	}

	function onWaiting() {
		console.log("[Player] onWaiting triggered");
		if (!localIsBuffering) {
			console.log("[Player] Buffering started (onWaiting)...");
			localIsBuffering = true;
			emitAction("buffering_start", $currentRoomId);
		}
	}

	function onPlaying() {
		console.log("[Player] onPlaying triggered");
		if (localIsBuffering) {
			console.log("[Player] Buffering ended (onPlaying)...");
			localIsBuffering = false;
			emitAction("buffering_end", $currentRoomId);
		}
	}

	function onCanPlay() {
		console.log("[Player] onCanPlay triggered");
		if (localIsBuffering) {
			localIsBuffering = false;
			emitAction("buffering_end", $currentRoomId);
		}
	}

	function onYoutubeError(e: CustomEvent) {
		console.error("Youtube Error:", e.detail);
		showError("YouTube Error Code: " + e.detail);
	}

	function showError(msg: string) {
		localIsBuffering = false;
		hasError = true;
		errorMessage = msg;
		emitAction("buffering_end", $currentRoomId);
	}

	function handleVideoError() {
		if (isYoutube) return;
		const err = videoElement.error;
		if (err && (err.code === 2 || err.code === 4)) {
			showCorsHelp = true;
			localIsBuffering = false;
			emitAction("buffering_end", $currentRoomId);
			return;
		}
		if (retryCount < MAX_RETRIES) {
			retryCount++;
			console.log(`[Player] Retrying load (${retryCount}/${MAX_RETRIES})...`);
			setTimeout(() => loadVideo(currentLoadedUrl, currentLoadedReferer), 1000);
		} else {
			showError("Video load failed.");
		}
	}

	//-------------------------------------------------------
	// UI Interactions
	//-------------------------------------------------------
	function togglePlay() {
		if (player) {
			player.isPlaying ? player.pause() : player.play();
		}
	}

	function handleSeek(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		const newTime = percent * duration;

		// Optimistic update handled by onSeeked or player
		emitAction("seek", { roomId: $currentRoomId, time: newTime });
	}

	function handleSeekHover(e: MouseEvent) {
		if (!peekHls && !isYoutube) initPeekHls();
		isHoveringSeek = true;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		seekHoverPercent = (e.clientX - rect.left) / rect.width;
		seekHoverTime = seekHoverPercent * duration;
		if (peekVideo && !isNaN(seekHoverTime)) {
			if (Math.abs(peekVideo.currentTime - seekHoverTime) > 0.2) peekVideo.currentTime = seekHoverTime;
		}
	}

	function initPeekHls() {
		if (!currentLoadedUrl || peekHls) return;
		const videoUrl = getProxyUrl(currentLoadedUrl, currentLoadedReferer);
		if (Hls.isSupported() && isHlsSource(currentLoadedUrl)) {
			peekHls = new Hls({ autoStartLoad: true, maxBufferLength: 1, startLevel: 0 });
			peekHls.loadSource(videoUrl);
			peekHls.attachMedia(peekVideo);
		} else if (peekVideo) {
			peekVideo.src = videoUrl;
			peekVideo.load();
		}
	}

	function handleVolume(e: Event) {
		volume = parseFloat((e.target as HTMLInputElement).value);
		if (player) {
			player.setVolume(volume);
			if (volume === 0) player.setMute(true);
			else player.setMute(false);
		}
		isMuted = volume === 0;
	}

	function toggleMute() {
		isMuted = !isMuted;
		volume = isMuted ? 0 : 1;
		if (player) {
			player.setMute(isMuted);
			player.setVolume(volume);
		}
	}

	function toggleFullscreen() {
		const container = document.querySelector(".player-container");
		if (!document.fullscreenElement) container?.requestFullscreen();
		else document.exitFullscreen();
	}

	async function togglePip() {
		try {
			if (!isYoutube && videoElement) {
				if (document.pictureInPictureElement) await document.exitPictureInPicture();
				else if (videoElement?.requestPictureInPicture) await videoElement.requestPictureInPicture();
			}
		} catch (err) {
			console.error("PiP failed:", err);
		}
	}

	function skipTime(seconds: number) {
		const curr = player ? player.getCurrentTime() : 0;
		const newTime = Math.max(0, Math.min(duration, curr + seconds));
		emitAction("seek", { roomId: $currentRoomId, time: newTime });
	}

	function showControlsTemp() {
		showControls = true;
		hideCursor = false;
		clearTimeout(controlsTimeout);
		if (player?.isPlaying && !isHoveringSeek) {
			controlsTimeout = setTimeout(() => {
				showControls = false;
				hideCursor = true;
			}, 3000);
		}
	}

	function handleVideoClick() {
		if (window.innerWidth < 768) {
			showControls = !showControls;
			if (showControls) showControlsTemp();
		} else togglePlay();
	}

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
		switch (e.key.toLowerCase()) {
			case " ":
			case "k":
				e.preventDefault();
				togglePlay();
				showControlsTemp();
				break;
			case "arrowleft":
				skipTime(-5);
				showControlsTemp();
				break;
			case "arrowright":
				skipTime(5);
				showControlsTemp();
				break;
			case "f":
				toggleFullscreen();
				break;
			case "m":
				toggleMute();
				break;
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div
	class="player-container"
	role="application"
	class:hide-cursor={hideCursor}
	on:mousemove={showControlsTemp}
	on:mouseleave={() => (showControls = false)}
>
	<!-- YouTube Player Component -->
	{#if isYoutube && getYoutubeId(currentLoadedUrl)}
		<div class="youtube-wrapper">
			<YoutubeEmbed
				bind:this={ytComponent}
				videoId={getYoutubeId(currentLoadedUrl) || ""}
				startTime={currentTime}
				shouldPlay={player?.isPlaying ?? false}
				{volume}
				{isMuted}
				on:ready={onYoutubeReady}
				on:timeupdate={onYoutubeTimeUpdate}
				on:play={onPlay}
				on:pause={onPause}
				on:waiting={onWaiting}
				on:ended={onPause}
				on:error={onYoutubeError}
				on:canplay={onCanPlay}
			/>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="yt-click-overlay" on:click={handleVideoClick}></div>
		</div>
	{/if}

	<!-- HTML5 Video Player -->
	<!-- svelte-ignore a11y-media-has-caption -->
	<video
		bind:this={videoElement}
		class:hidden={isYoutube}
		playsinline
		crossorigin="anonymous"
		on:timeupdate={onTimeUpdate}
		on:durationchange={() => (duration = videoElement.duration)}
		on:play={onPlay}
		on:pause={onPause}
		on:seeked={onSeeked}
		on:waiting={onWaiting}
		on:playing={onPlaying}
		on:canplay={onCanPlay}
		on:click={handleVideoClick}
		on:error={handleVideoError}
	></video>

	{#if $isVideoChanging || ($roomState?.videoUrl && (localIsBuffering || $isWaitingForOthers))}
		<LoadingOverlay
			isVideoChanging={$isVideoChanging}
			localIsBuffering={localIsBuffering && !$isWaitingForOthers}
		/>
	{:else if !$roomState?.videoUrl}
		<NoVideoOverlay />
	{/if}

	{#if showCorsHelp}
		<CorsHelpOverlay
			on:retry={() => {
				showCorsHelp = false;
				loadVideo(currentLoadedUrl, currentLoadedReferer);
			}}
		/>
	{:else if hasError || $roomError}
		<ErrorOverlay
			errorMessage={errorMessage || $roomError || ""}
			onRetry={() => {
				roomError.set(null);
				hasError = false;
				loadVideo(currentLoadedUrl, currentLoadedReferer);
			}}
		/>
	{/if}

	<div class="controls-overlay {showControls || !player?.isPlaying ? 'visible' : ''}">
		{#if !isYoutube}
			<div class="peek-video-container" style="display: none;">
				<!-- svelte-ignore a11y-media-has-caption -->
				<video bind:this={peekVideo} muted playsinline preload="auto"></video>
			</div>
		{/if}

		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="progress-bar-container"
			role="slider"
			tabindex="0"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={duration ? (currentTime / duration) * 100 : 0}
			on:mousemove={handleSeekHover}
			on:mouseleave={() => (isHoveringSeek = false)}
			on:click={handleSeek}
			on:keydown={(e) => {
				if (e.key === "ArrowRight") skipTime(5);
				if (e.key === "ArrowLeft") skipTime(-5);
			}}
		>
			<div class="progress-bg"></div>
			<div class="progress-buffered" style="width: {buffered}%"></div>
			<div class="progress-current" style="width: {duration ? (currentTime / duration) * 100 : 0}%"></div>
			{#if isHoveringSeek}
				<SeekTooltip {seekHoverPercent} {seekHoverTime} {peekVideo} />
				<div class="seek-ghost" style="width: {seekHoverPercent * 100}%"></div>
			{/if}
		</div>

		<Controls
			isPlaying={player?.isPlaying ?? false}
			{currentTime}
			{duration}
			{volume}
			{isMuted}
			{togglePlay}
			{skipTime}
			{toggleMute}
			{handleVolume}
			{togglePip}
			{toggleFullscreen}
		/>
	</div>
</div>

<style lang="scss">
	$primary: #5865f2;
	.player-container {
		position: relative;
		width: 100%;
		aspect-ratio: 16/9;
		background: black;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
		@media (max-width: 768px) {
			border-radius: 0;
		}
		&.hide-cursor {
			cursor: none;
		}

		video,
		.youtube-wrapper {
			width: 100%;
			height: 100%;
			object-fit: contain;
			aspect-ratio: 16/9;
			position: absolute;
			top: 0;
			left: 0;
		}

		video.hidden {
			display: none;
			visibility: hidden;
			pointer-events: none;
		}

		.youtube-wrapper {
			position: relative; // Needs to be relative for overlay absolute
		}

		.yt-click-overlay {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: calc(100% - 80px); /* Leave space for controls */
			z-index: 10;
			cursor: pointer;
		}

		.controls-overlay {
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			padding: 1.5rem;
			background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
			opacity: 0;
			transition: opacity 0.3s;
			display: flex;
			flex-direction: column;
			gap: 10px;
			z-index: 20;
			&.visible {
				opacity: 1;
			}
			.progress-bar-container {
				position: relative;
				height: 6px;
				width: 100%;
				cursor: pointer;
				transition: height 0.2s;
				&:hover {
					height: 10px;
				}
				.progress-bg {
					position: absolute;
					top: 0;
					bottom: 0;
					left: 0;
					right: 0;
					background: rgba(255, 255, 255, 0.2);
					border-radius: 5px;
				}
				.progress-buffered {
					position: absolute;
					top: 0;
					bottom: 0;
					left: 0;
					background: rgba(255, 255, 255, 0.4);
					border-radius: 5px;
					transition: width 0.2s;
				}
				.progress-current {
					position: absolute;
					top: 0;
					bottom: 0;
					left: 0;
					background: $primary;
					border-radius: 5px;
					height: 100%;
					&::after {
						content: "";
						position: absolute;
						right: -5px;
						top: -3px;
						width: 16px;
						height: 16px;
						border-radius: 50%;
						background: white;
						opacity: 0;
						transition: opacity 0.2s;
					}
				}
				&:hover .progress-current::after {
					opacity: 1;
				}
				.seek-ghost {
					position: absolute;
					top: 0;
					bottom: 0;
					left: 0;
					background: rgba(255, 255, 255, 0.1);
					pointer-events: none;
				}
			}
		}
	}
</style>
