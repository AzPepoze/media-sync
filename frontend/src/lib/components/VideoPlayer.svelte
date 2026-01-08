<script lang="ts">
	import Hls from "hls.js";
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

	let hls: Hls | null = null;
	let peekHls: Hls | null = null;

	// State Tracking
	let isYoutube = false;
	let currentLoadedUrl = "";
	let currentLoadedReferer = "";

	// Sync State
	let isRemoteActionActive = false;
	let isRemoteSeeking = false;
	let isSyncing = false; // Flag to prevent loopback echoes
	let localIsBuffering = false;

	// Error State
	let hasError = false;
	let showCorsHelp = false;
	let errorMessage = "";
	let retryCount = 0;
	const MAX_RETRIES = 2;

	// UI State
	let isPlaying = false;
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
	let remoteActionTimeout: ReturnType<typeof setTimeout>;

	function setSyncState(isActive: boolean, duration = 1500) {
		clearTimeout(remoteActionTimeout);
		if (isActive) {
			isRemoteActionActive = true;
			isSyncing = true;
			remoteActionTimeout = setTimeout(() => {
				isRemoteActionActive = false;
				isSyncing = false;
			}, duration);
		} else {
			isRemoteActionActive = false;
			isSyncing = false;
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

	function loadCurrentVideo() {
		if (!$roomState?.videoUrl) return;

		const ytId = getYoutubeId($roomState.videoUrl);

		const isDirectLink =
			ytId ||
			isHlsSource($roomState.videoUrl) ||
			$roomState.videoUrl.match(/\.(mp4|webm|mkv|mov|avi|flv)(\?|$)/i) ||
			$roomState.videoUrl.includes("googlevideo.com");

		if (!isDirectLink) {
			console.log("[Player] URL skipping load.");
			return;
		}

		const stateReferer = $roomState.referer || "";

		let targetTime = $roomState.currentTime;
		if ($roomState.isPlaying && $roomState.lastUpdated) {
			const elapsed = (Date.now() - $roomState.lastUpdated) / 1000;
			targetTime += elapsed;
		}

		if ($roomState.videoUrl !== currentLoadedUrl || stateReferer !== currentLoadedReferer) {
			loadVideo($roomState.videoUrl, stateReferer, targetTime, $roomState.isPlaying);
		} else {
			// --- Sync Check ---
			// If we are currently processing a remote action (socket event), 
			// do not interfere with local state corrections to avoid fighting/loops.
			if (isRemoteActionActive) return;

			let currentPlayerTime = 0;
			if (isYoutube && ytComponent) currentPlayerTime = ytComponent.getCurrentTime();
			else if (!isYoutube && videoElement) currentPlayerTime = videoElement.currentTime;

			const diff = Math.abs(currentPlayerTime - targetTime);
			if (diff > 2) {
				console.log(`[Sync] Drift detected (${diff.toFixed(2)}s). Resyncing...`);
				setSyncState(true, 2000);
				if (isYoutube && ytComponent) ytComponent.seekTo(targetTime);
				else if (videoElement) videoElement.currentTime = targetTime;
			}

			const shouldBePlaying = $roomState.isPlaying;
			let amIPlaying = false;

			if (isYoutube && ytComponent) {
				const state = ytComponent.getPlayerState();
				amIPlaying = state === 1;
			} else if (videoElement) {
				amIPlaying = !videoElement.paused;
			}

			if (shouldBePlaying && !amIPlaying && !$isWaitingForOthers && !localIsBuffering) {
				setSyncState(true, 1500);
				if (isYoutube && ytComponent) ytComponent.play();
				else if (videoElement) videoElement.play().catch(() => {});
			} else if (!shouldBePlaying && amIPlaying) {
				setSyncState(true, 1500);
				if (isYoutube && ytComponent) ytComponent.pause();
				else if (videoElement) videoElement.pause();
			}
		}
	}

	$: if ($roomState) loadCurrentVideo();

	$: if ($socket) {
		$socket.off("connect");
		$socket.off("player_action");
		$socket.off("room_buffering");

		$socket.on("connect", () => {
			console.log("[Player] Socket connected, re-syncing...");
			currentLoadedUrl = "";
			loadCurrentVideo();
		});

		$socket.on("player_action", (data: { action: string; time: number }) => {
			if (!videoElement && !ytComponent) return;

			let playerTime = 0;
			if (isYoutube && ytComponent) playerTime = ytComponent.getCurrentTime();
			else if (videoElement) playerTime = videoElement.currentTime;

			console.log("[Player] Action received:", data.action, "at", data.time);

			// Activate Sync State
			setSyncState(true, 1500);

			if (data.action === "seek") {
				if (Math.abs(playerTime - data.time) < 0.5) {
					setSyncState(false);
					return;
				}

				isRemoteSeeking = true;
				if (isYoutube && ytComponent) ytComponent.seekTo(data.time);
				else if (videoElement) videoElement.currentTime = data.time;

				localIsBuffering = true;
				emitAction("buffering_start", $currentRoomId);

				setTimeout(() => {
					if (isYoutube) onSeeked();
					else if (Math.abs(videoElement.currentTime - data.time) < 0.2) onSeeked();
				}, 1000);
				// Keep Sync active a bit longer for seek
				setSyncState(true, 2000);
				return;
			}

			const diff = Math.abs(playerTime - data.time);
			if (diff > 0.5) {
				if (isYoutube && ytComponent) ytComponent.seekTo(data.time);
				else if (videoElement) videoElement.currentTime = data.time;
			}

			if (data.action === "play") {
				isPlaying = true;
				if (isYoutube && ytComponent) ytComponent.play();
				else if (videoElement)
					videoElement.play().catch(() => {
						isPlaying = false;
					});
			} else if (data.action === "pause") {
				isPlaying = false;
				if (isYoutube && ytComponent) ytComponent.pause();
				else if (videoElement) videoElement.pause();
			}

			setSyncState(true, 1500);
		});

		$socket.on("room_buffering", (isBuffering: boolean) => {
			if (!videoElement && !ytComponent) return;
			setSyncState(true, 1000);

			let playerPaused = true;
			if (isYoutube && ytComponent) playerPaused = ytComponent.getPlayerState() !== 1;
			else if (videoElement) playerPaused = videoElement.paused;

			if (isBuffering) {
				if (!playerPaused) {
					if (isYoutube && ytComponent) ytComponent.pause();
					else if (videoElement) {
						videoElement.pause();
						isPlaying = false;
					}
				}
			} else if ($roomState.isPlaying && !localIsBuffering) {
				if (playerPaused) {
					if (isYoutube && ytComponent) ytComponent.play();
					else if (videoElement) {
						videoElement.play().catch(() => {});
						isPlaying = true;
					}
				}
			}
			setSyncState(true, 1000);
		});
	}

	async function loadVideo(url: string, referer: string, startTime = 0, shouldPlay = false) {
		localIsBuffering = true;
		emitAction("buffering_start", $currentRoomId);
		hasError = false;
		showCorsHelp = false;
		errorMessage = "";
		currentTime = startTime;
		buffered = 0;
		isPlaying = shouldPlay;
		retryCount = 0;
		isRemoteActionActive = true;

		currentLoadedUrl = url;
		currentLoadedReferer = referer;

		const ytId = getYoutubeId(url);

		if (videoElement) {
			videoElement.pause();
			videoElement.removeAttribute("src");
			videoElement.load();
		}
		if (hls) {
			hls.destroy();
			hls = null;
		}

		if (ytId) {
			isYoutube = true;
			return;
		} else {
			isYoutube = false;
		}

		const videoUrl = getProxyUrl(url, referer);

		if (Hls.isSupported() && isHlsSource(url)) {
			hls = new Hls({
				capLevelToPlayerSize: true,
				manifestLoadingMaxRetry: 2,
				levelLoadingMaxRetry: 2,
				fragLoadingMaxRetry: 3,
				enableWorker: true,
				xhrSetup: (xhr, url) => {
					xhr.withCredentials = false;
				},
			});
			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				isVideoChanging.set(false);
				if (videoElement) {
					videoElement.currentTime = startTime;
					if (shouldPlay) videoElement.play().catch(() => {});
				}
				setSyncState(true, 2000);
			});
			hls.loadSource(videoUrl);
			hls.attachMedia(videoElement);
			hls.on(Hls.Events.ERROR, (e, data) => {
				const status = data.response?.code;
				const isNetworkError = data.type === Hls.ErrorTypes.NETWORK_ERROR;
				const isCorsLike = isNetworkError && (!status || status === 0);

				if (isCorsLike) {
					if (
						buffered === 0 ||
						data.details === "manifestLoadError" ||
						data.details === "fragLoadError"
					) {
						hls?.destroy();
						showCorsHelp = true;
						localIsBuffering = false;
						emitAction("buffering_end", $currentRoomId);
						return;
					}
				}

				if (data.fatal) {
					if (retryCount < MAX_RETRIES && isNetworkError) {
						retryCount++;
						setTimeout(() => hls?.loadSource(videoUrl), 1000);
					} else {
						hls?.destroy();
						showError(status ? `Error ${status}: Failed to load stream.` : "Playback failed.");
					}
				}
			});
		} else {
			videoElement.src = videoUrl;
			videoElement.currentTime = startTime;
			videoElement.oncanplay = () => {
				isVideoChanging.set(false);
				if (shouldPlay) videoElement.play().catch(() => {});
				setSyncState(true, 2000);
			};
			videoElement.load();
		}
	}

	function onYoutubeReady(e: CustomEvent) {
		console.log("[Youtube] Ready");
		isVideoChanging.set(false);
		duration = e.detail.duration;
		localIsBuffering = false;
		emitAction("buffering_end", $currentRoomId);
		setSyncState(true, 2000);
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
		if (isYoutube) {
			console.log("[Youtube] Playing -> Clearing Buffering");
			isVideoChanging.set(false);
			localIsBuffering = false;
			emitAction("buffering_end", $currentRoomId);
		}

		if (isPlaying) return;
		isPlaying = true;

		// Use isSyncing check only for Youtube
		const blockSync = isYoutube ? isSyncing : false;

		if (!isRemoteActionActive && !isRemoteSeeking && !blockSync && !$isWaitingForOthers && !localIsBuffering) {
			const t = isYoutube && ytComponent ? ytComponent.getCurrentTime() : videoElement?.currentTime;
			emitAction("play", { roomId: $currentRoomId, time: t });
		}
	}

	function onPause() {
		if (!isPlaying) return;
		isPlaying = false;

		const blockSync = isYoutube ? isSyncing : false;

		if (!isRemoteActionActive && !isRemoteSeeking && !blockSync && !$isWaitingForOthers && !localIsBuffering) {
			const t = isYoutube && ytComponent ? ytComponent.getCurrentTime() : videoElement?.currentTime;
			emitAction("pause", { roomId: $currentRoomId, time: t });
		}
	}

	function onYoutubeError(e: CustomEvent) {
		console.error("Youtube Error:", e.detail);
		showError("YouTube Error Code: " + e.detail);
	}

	function onSeeked() {
		if (localIsBuffering) {
			localIsBuffering = false;
			emitAction("buffering_end", $currentRoomId);
		}
		if (isRemoteSeeking) {
			isRemoteSeeking = false;
			return;
		}

		const blockSync = isYoutube ? isSyncing : false;

		if (!isRemoteActionActive && !blockSync) {
			const t = isYoutube && ytComponent ? ytComponent.getCurrentTime() : videoElement?.currentTime;
			emitAction("seek", { roomId: $currentRoomId, time: t });
		}
	}

	function onWaiting() {
		if (!localIsBuffering) {
			localIsBuffering = true;
			emitAction("buffering_start", $currentRoomId);
		}
	}

	function onPlaying() {
		if (localIsBuffering) {
			localIsBuffering = false;
			emitAction("buffering_end", $currentRoomId);
		}
	}

	function onCanPlay() {
		if (localIsBuffering) {
			localIsBuffering = false;
			emitAction("buffering_end", $currentRoomId);
		}
	}

	function showError(msg: string) {
		localIsBuffering = false;
		hasError = true;
		errorMessage = msg;
		emitAction("buffering_end", $currentRoomId);
	}

	function handleVideoError() {
		if (hls || isYoutube) return;
		const err = videoElement.error;
		if (err && (err.code === 2 || err.code === 4)) {
			showCorsHelp = true;
			localIsBuffering = false;
			emitAction("buffering_end", $currentRoomId);
			return;
		}
		if (retryCount < MAX_RETRIES) {
			retryCount++;
			setTimeout(() => loadVideo(currentLoadedUrl, currentLoadedReferer), 1000);
		} else {
			showError("Video load failed.");
		}
	}

	function togglePlay() {
		if (isYoutube && ytComponent) {
			isPlaying ? ytComponent.pause() : ytComponent.play();
		} else if (videoElement) {
			isPlaying ? videoElement.pause() : videoElement.play();
		}
	}

	function handleSeek(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		const newTime = percent * duration;
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

	function handleVolume(e: Event) {
		volume = parseFloat((e.target as HTMLInputElement).value);
		if (isYoutube && ytComponent) {
			ytComponent.setVolume(volume);
			if (volume === 0) ytComponent.mute();
			else ytComponent.unMute();
		} else if (videoElement) {
			videoElement.volume = volume;
		}
		isMuted = volume === 0;
	}

	function toggleMute() {
		isMuted = !isMuted;
		volume = isMuted ? 0 : 1;
		if (isYoutube && ytComponent) {
			isMuted ? ytComponent.mute() : ytComponent.unMute();
			ytComponent.setVolume(volume);
		} else if (videoElement) {
			videoElement.volume = volume;
			videoElement.muted = isMuted;
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
		const curr = isYoutube && ytComponent ? ytComponent.getCurrentTime() : videoElement?.currentTime;
		const newTime = Math.max(0, Math.min(duration, curr + seconds));
		emitAction("seek", { roomId: $currentRoomId, time: newTime });
	}

	function showControlsTemp() {
		showControls = true;
		hideCursor = false;
		clearTimeout(controlsTimeout);
		if (isPlaying && !isHoveringSeek) {
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
				shouldPlay={isPlaying}
				{volume}
				{isMuted}
				on:ready={onYoutubeReady}
				on:timeupdate={onYoutubeTimeUpdate}
				on:play={onPlay}
				on:pause={onPause}
				on:waiting={onWaiting}
				on:ended={onPause}
				on:error={onYoutubeError}
			/>
			<!-- Click Overlay -->
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

	<div class="controls-overlay {showControls || !isPlaying ? 'visible' : ''}">
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
			{isPlaying}
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

			&.hidden {
				display: none;
				visibility: hidden;
				pointer-events: none;
			}
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
