<script lang="ts">
	import { tick } from "svelte";
	import {
		socket,
		roomState,
		isWaitingForOthers,
		isVideoChanging,
		roomError,
		currentRoomId,
		emitPlay,
		emitPause,
		emitBufferingStart,
		emitBufferingEnd,
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
	let isRemoteSeeking = false;
	let isSeeking = false;
	let isSyncing = false;
	let localIsBuffering = false;
	let lastBufferingEnd = 0; // Timestamp of last buffering end to prevent rapid cycles
	let lastServerAction = 0; // Timestamp of last server action to skip drift checks

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
			console.log("[Sync] No video URL, ending buffering");
			emitBufferingEnd();
			return;
		}

		// Don't run sync logic if we're in the middle of seeking
		if (isSeeking || isRemoteSeeking) {
			console.log(
				"[Sync] Skipping sync during seek (isSeeking:",
				isSeeking,
				"isRemoteSeeking:",
				isRemoteSeeking,
				")"
			);
			return;
		}

		console.log(
			"[Sync] loadCurrentVideo - localIsBuffering:",
			localIsBuffering,
			"isWaitingForOthers:",
			$isWaitingForOthers
		);

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
			// New video - need to buffer
			localIsBuffering = true;
			await loadVideo($roomState.videoUrl, stateReferer, targetTime, $roomState.isPlaying);
		} else {
			if (!player || !player.isReady) {
				console.log("[Sync] Player not ready, skipping");
				return;
			}

			// Don't sync if we're seeking - wait for seek to complete
			if (isSeeking) {
				console.log("[Sync] Still seeking, skipping drift check");
				return;
			}

			// Don't drift check when waiting for others - room time is frozen and will be wrong
			if ($isWaitingForOthers) {
				console.log("[Sync] Waiting for others, skipping drift check - just handle play/pause state");
				// Only handle play/pause state sync
				const shouldBePlaying = $roomState.isPlaying && !$isWaitingForOthers;
				if (!shouldBePlaying && player.isPlaying) {
					console.log("[Sync] Pausing playback (waiting for others)");
					player.pause(true); // silent=true, don't emit
				}
				return;
			}

			// Skip drift check if we just received a server action (within 1 second)
			if (Date.now() - lastServerAction < 1000) {
				console.log("[Sync] Skipping drift check - recent server action");
				return;
			}

			const currentPlayerTime = player.getCurrentTime();
			const diff = Math.abs(currentPlayerTime - targetTime);
			console.log(
				"[Sync] Drift check - currentTime:",
				currentPlayerTime.toFixed(2),
				"targetTime:",
				targetTime.toFixed(2),
				"diff:",
				diff.toFixed(2)
			);

			if (diff > 2) {
				console.log(`[Sync] Drift detected (${diff.toFixed(2)}s). Resyncing...`);
				player.seek(targetTime);
			}

			// Play/Pause State Sync
			const shouldBePlaying = $roomState.isPlaying && !$isWaitingForOthers;
			const isActuallyPlaying = player.isPlaying;
			console.log(
				"[Sync] State check - shouldBePlaying:",
				shouldBePlaying,
				"isActuallyPlaying:",
				isActuallyPlaying,
				"roomState.isPlaying:",
				$roomState.isPlaying,
				"isWaitingForOthers:",
				$isWaitingForOthers
			);

			// Only intervene if there is a mismatch AND we are not buffering locally
			if (shouldBePlaying && !isActuallyPlaying && !localIsBuffering) {
				console.log("[Sync] Resuming playback");
				player.play(true); // silent=true, don't emit
			} else if (!shouldBePlaying && isActuallyPlaying) {
				console.log("[Sync] Pausing playback (waiting or paused)");
				player.pause(true); // silent=true, don't emit
			}
		}
	}

	async function loadVideo(url: string, referer: string, startTime = 0, shouldPlay = false) {
		localIsBuffering = true;
		emitBufferingStart();

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
							emitBufferingEnd();
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
	$: if ($isWaitingForOthers !== undefined) loadCurrentVideo();

	// Track our handlers so we can remove only our own, not the socket store's
	let playerActionHandler: ((data: { action: string; time: number }) => void) | null = null;
	let connectHandler: (() => void) | null = null;

	$: if ($socket) {
		// Remove only our previous handlers (not all handlers)
		if (connectHandler) $socket.off("connect", connectHandler);
		if (playerActionHandler) $socket.off("player_action", playerActionHandler);

		connectHandler = () => {
			console.log("[Player] Socket connected, re-syncing...");
			currentLoadedUrl = "";
			loadCurrentVideo();
		};

		playerActionHandler = (data: { action: string; time: number }) => {
			if (!player) return;
			const playerTime = player.getCurrentTime();
			console.log("[Player] Action received:", data.action, "at", data.time);

			// For seek action - always process it
			if (data.action === "seek") {
				console.log(
					"[Player] Remote seek received - current:",
					playerTime.toFixed(2),
					"target:",
					data.time.toFixed(2)
				);
				if (Math.abs(playerTime - data.time) < 0.5) {
					console.log("[Player] Seek difference < 0.5s, ignoring");
					return;
				}
				// Set seeking flags
				console.log("[Player] Remote seek - setting flags");
				isRemoteSeeking = true;
				isSeeking = true;
				localIsBuffering = true;
				emitBufferingStart();

				console.log("[Player] Executing remote seek to", data.time.toFixed(2));
				player.seek(data.time);
				return;
			}

			// For pause during seek - just pause locally, don't emit anything
			if (data.action === "pause") {
				console.log("[Player] Pause action received, pausing player");
				player.pause(true); // silent=true, don't emit
				return;
			}

			// For play action - sync time and play
			if (data.action === "play") {
				console.log("[Player] Play action received");
				lastServerAction = Date.now();
				// Clear seeking flags when play is received
				isSeeking = false;
				isRemoteSeeking = false;
				// Sync time if drift is significant
				const diff = Math.abs(playerTime - data.time);
				if (diff > 0.5) {
					console.log("[Player] Syncing time before play, diff:", diff.toFixed(2));
					player.seek(data.time);
				}
				player.play(true); // silent=true, don't emit
				return;
			}
		};

		$socket.on("connect", connectHandler);
		$socket.on("player_action", playerActionHandler);
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
		emitBufferingEnd();
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
		console.log(
			"[Player] onPlay triggered - isSeeking:",
			isSeeking,
			"isRemoteSeeking:",
			isRemoteSeeking,
			"isSilentAction:",
			player?.isSilentAction,
			"roomState.isPlaying:",
			$roomState.isPlaying
		);

		// Check if this was a silent action (sync/server-initiated)
		const wasSilent = player?.isSilentAction ?? false;
		if (player) {
			player.isSilentAction = false; // Reset flag
			player.updatePlayingState(true);
		}

		// Handle YouTube buffering recovery
		if (isYoutube && localIsBuffering) {
			console.log("[Youtube] Recovered from Buffering -> Playing");
			localIsBuffering = false;
			return;
		}

		// Don't emit if this was a silent action (sync/server-initiated)
		if (wasSilent) {
			console.log("[Player] Silent play action, not emitting");
			return;
		}

		// Don't emit during seek flow
		if (isSeeking || isRemoteSeeking) {
			console.log("[Player] Seeking, not emitting play");
			return;
		}

		// User clicked play - emit to server
		const t = player ? player.getCurrentTime() : 0;
		console.log("[Player] User play action, emitting at time:", t.toFixed(2));
		emitPlay(t);
	}

	function onPause() {
		console.log(
			"[Player] onPause triggered - isSeeking:",
			isSeeking,
			"isRemoteSeeking:",
			isRemoteSeeking,
			"isSilentAction:",
			player?.isSilentAction,
			"roomState.isPlaying:",
			$roomState.isPlaying
		);

		// Check if this was a silent action (sync/server-initiated)
		const wasSilent = player?.isSilentAction ?? false;
		if (player) {
			player.isSilentAction = false; // Reset flag
			player.updatePlayingState(false);
		}

		// Don't emit if this was a silent action (sync/server-initiated)
		if (wasSilent) {
			console.log("[Player] Silent pause action, not emitting");
			return;
		}

		// Don't emit during seek flow
		if (isSeeking || isRemoteSeeking) {
			console.log("[Player] Seeking, not emitting pause");
			return;
		}

		// User clicked pause - emit to server
		const t = player ? player.getCurrentTime() : 0;
		console.log("[Player] User pause action, emitting at time:", t.toFixed(2));
		emitPause(t);
	}

	function onSeeked() {
		const currentTime = player ? player.getCurrentTime() : 0;
		console.log("[Player] onSeeked triggered at time:", currentTime.toFixed(2));

		// Clear seeking flags
		const wasRemoteSeeking = isRemoteSeeking;
		console.log("[Player] Seek complete - wasRemoteSeeking:", wasRemoteSeeking);

		// Only clear remote seeking flag
		isRemoteSeeking = false;

		// End buffering state - server will send play if needed
		if (localIsBuffering) {
			console.log("[Player] Ending buffering state after seek");
			localIsBuffering = false;
			lastBufferingEnd = Date.now();
			emitBufferingEnd();
		}

		// Clear isSeeking after a delay to let room state update
		setTimeout(() => {
			console.log("[Player] Clearing isSeeking flag");
			isSeeking = false;
		}, 200);

		console.log("[Player] onSeeked complete - waiting for server action");
	}
	function onWaiting() {
		console.log("[Player] onWaiting triggered");
		// Don't trigger buffering if we're just seeking
		if (isSeeking || isRemoteSeeking) {
			console.log("[Player] Waiting during seek, not triggering buffering");
			return;
		}
		// Don't trigger buffering if we just finished buffering (debounce)
		if (Date.now() - lastBufferingEnd < 500) {
			console.log("[Player] Waiting too soon after buffering end, ignoring");
			return;
		}
		if (!localIsBuffering) {
			console.log("[Player] Buffering started (onWaiting)...");
			localIsBuffering = true;
			emitBufferingStart();
		}
	}

	function onPlaying() {
		console.log("[Player] onPlaying triggered");
		if (localIsBuffering) {
			console.log("[Player] Buffering ended (onPlaying)...");
			localIsBuffering = false;
			lastBufferingEnd = Date.now();
			emitBufferingEnd();
		}
	}

	function onCanPlay() {
		console.log("[Player] onCanPlay triggered");
		if (localIsBuffering) {
			localIsBuffering = false;
			lastBufferingEnd = Date.now();
			emitBufferingEnd();
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
		emitBufferingEnd();
	}

	function handleVideoError() {
		if (isYoutube) return;
		const err = videoElement.error;
		if (err && (err.code === 2 || err.code === 4)) {
			showCorsHelp = true;
			localIsBuffering = false;
			emitBufferingEnd();
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

	function seekTo(time: number) {
		console.log("[Seek] Starting seek to", time.toFixed(2), "- wasPlaying:", player?.isPlaying);
		// Remember if we were playing before seek
		const wasPlaying = player?.isPlaying ?? false;

		// Set seeking flag and start buffering
		isSeeking = true;
		localIsBuffering = true;
		console.log("[Seek] Setting isSeeking=true, localIsBuffering=true, emitting buffering_start");
		emitBufferingStart();

		// Pause locally first
		if (player && player.isPlaying) {
			console.log("[Seek] Pausing player before seek");
			player.pause(true); // silent=true, don't emit
		}

		// Seek locally
		if (player) {
			console.log("[Seek] Executing local player.seek(", time.toFixed(2), ")");
			player.seek(time);
		}

		// Emit seek with wasPlaying flag - server will:
		// 1. Pause all clients
		// 2. Seek all clients
		// 3. Resume when everyone is ready (if wasPlaying was true)
		console.log("[Seek] Emitting seek action with wasPlaying:", wasPlaying);
		$socket?.emit("seek", { roomId: $currentRoomId, time, wasPlaying });
	}

	function handleSeek(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		const newTime = percent * duration;
		seekTo(newTime);
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
		seekTo(newTime);
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
				on:seeked={onSeeked}
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
		<LoadingOverlay isVideoChanging={$isVideoChanging} {localIsBuffering} />
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
