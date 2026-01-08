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
		SERVER_URL,
	} from "../stores/socket";
	// Sub-components
	import SeekTooltip from "./player/SeekTooltip.svelte";
	import Controls from "./player/Controls.svelte";
	import LoadingOverlay from "./player/LoadingOverlay.svelte";
	import ErrorOverlay from "./player/ErrorOverlay.svelte";
	import NoVideoOverlay from "./player/NoVideoOverlay.svelte";
	import CorsHelpOverlay from "./player/CorsHelpOverlay.svelte";

	let videoElement: HTMLVideoElement;
	let peekVideo: HTMLVideoElement;
	let hls: Hls | null = null;
	let peekHls: Hls | null = null;

	// State Tracking
	let currentLoadedUrl = "";
	let currentLoadedReferer = "";
	let isRemoteActionActive = false;
	let isRemoteSeeking = false;
	let localIsBuffering = false;
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

	function loadCurrentVideo() {
		if (!$roomState?.videoUrl) return;

		// Check if it's a direct media link (ends with extension or contains common stream keywords)
		const isDirectLink =
			isHlsSource($roomState.videoUrl) ||
			$roomState.videoUrl.match(/\.(mp4|webm|mkv|mov|avi|flv)(\?|$)/i) ||
			$roomState.videoUrl.includes("googlevideo.com");

		if (!isDirectLink) {
			console.log("[Player] URL is not a direct media link yet, skipping load.");
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
		} else if (videoElement) {
			const diff = Math.abs(videoElement.currentTime - targetTime);
			if (diff > 2) {
				console.log(`[Sync] Drift detected (${diff.toFixed(2)}s). Resyncing...`);
				isRemoteActionActive = true;
				videoElement.currentTime = targetTime;
				setTimeout(() => (isRemoteActionActive = false), 2000);
			}
			if ($roomState.isPlaying && videoElement.paused && !$isWaitingForOthers && !localIsBuffering) {
				videoElement.play().catch(() => {});
			} else if (!$roomState.isPlaying && !videoElement.paused) {
				videoElement.pause();
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
			if (!videoElement) return;
			console.log("[Player] Action received:", data.action, "at", data.time);

			if (data.action === "seek") {
				// Avoid re-seeking if we are already close (e.g. sender)
				if (Math.abs(videoElement.currentTime - data.time) < 0.5) {
					console.log("[Player] Ignoring seek, already at time.");
					return;
				}

				console.log("[Player] Remote seek to", data.time);
				isRemoteSeeking = true;
				videoElement.currentTime = data.time;

				localIsBuffering = true;
				emitAction("buffering_start", $currentRoomId);

				// Safety: If the video is already at this time, onSeeked might not fire
				setTimeout(() => {
					if (isRemoteSeeking && Math.abs(videoElement.currentTime - data.time) < 0.2) {
						onSeeked();
					}
				}, 1000);
				return;
			}
			isRemoteActionActive = true;
			const diff = Math.abs(videoElement.currentTime - data.time);
			if (diff > 0.5) videoElement.currentTime = data.time;
			if (data.action === "play") {
				isPlaying = true;
				videoElement.play().catch(() => {
					isPlaying = false;
				});
			} else if (data.action === "pause") {
				videoElement.pause();
				isPlaying = false;
			}
			setTimeout(() => {
				isRemoteActionActive = false;
			}, 800);
		});

		$socket.on("room_buffering", (isBuffering: boolean) => {
			if (!videoElement) return;
			console.log("[Player] Room buffering updated:", isBuffering);

			isRemoteActionActive = true;
			if (isBuffering) {
				if (!videoElement.paused) {
					videoElement.pause();
					isPlaying = false;
				}
			} else if ($roomState.isPlaying && !localIsBuffering) {
				// Room should be playing and we are not buffering anymore
				if (videoElement.paused) {
					videoElement.play().catch(() => {});
				}
				isPlaying = true;
			}
			setTimeout(() => {
				isRemoteActionActive = false;
			}, 200);
		});
	}

	function checkIsMobile() {
		if (typeof navigator === "undefined") return false;
		return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
	}

	function getProxyUrl(url: string, referer: string = ""): string {
		const isMobile = checkIsMobile();
		const lowerUrl = url.toLowerCase();

		if (isMobile) {
			let videoUrl = `${SERVER_URL}/proxy?url=${encodeURIComponent(url)}&proxySegments=true`;
			if (referer) videoUrl += `&referer=${encodeURIComponent(referer)}`;
			return videoUrl;
		}

		if (lowerUrl.includes(".m3u8") || lowerUrl.includes(".txt") || lowerUrl.includes(".mpd")) {
			let videoUrl = `${SERVER_URL}/proxy?url=${encodeURIComponent(url)}`; // proxySegments defaults to false
			if (referer) videoUrl += `&referer=${encodeURIComponent(referer)}`;
			return videoUrl;
		}

		return url;
	}
	function isHlsSource(url: string): boolean {
		const lowerUrl = url.toLowerCase();
		return lowerUrl.includes(".m3u8") || lowerUrl.includes(".txt");
	}

	function loadVideo(url: string, referer: string, startTime = 0, shouldPlay = false) {
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

		if (videoElement) {
			videoElement.pause();
			videoElement.currentTime = startTime;
			videoElement.removeAttribute("src");
			videoElement.load();
		}

		currentLoadedUrl = url;
		currentLoadedReferer = referer;

		const videoUrl = getProxyUrl(url, referer);

		if (hls) {
			hls.destroy();
			hls = null;
		}

		if (Hls.isSupported() && isHlsSource(url)) {
			hls = new Hls({
				capLevelToPlayerSize: true,
				manifestLoadingMaxRetry: 2,
				levelLoadingMaxRetry: 2,
				fragLoadingMaxRetry: 3,
				enableWorker: true,
			});
			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				isVideoChanging.set(false);
				if (videoElement) {
					videoElement.currentTime = startTime;
					if (shouldPlay) videoElement.play().catch(() => {});
				}
				setTimeout(() => {
					isRemoteActionActive = false;
				}, 2000);
			});
			hls.loadSource(videoUrl);
			hls.attachMedia(videoElement);
			hls.on(Hls.Events.ERROR, (e, data) => {
				const status = data.response?.code;
				const isNetworkError = data.type === Hls.ErrorTypes.NETWORK_ERROR;
				const isCorsLike = isNetworkError && (!status || status === 0);

				// Immediate CORS detection for Manifest or Initial Fragment
				if (isCorsLike) {
					// If it fails immediately (no buffer) or it's a manifest issue, it's likely CORS.
					if (
						buffered === 0 ||
						data.details === "manifestLoadError" ||
						data.details === "fragLoadError"
					) {
						console.warn("[Player] Detected potential CORS error:", data.details);
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
				setTimeout(() => {
					isRemoteActionActive = false;
				}, 2000);
			};
			videoElement.load();
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

	function onTimeUpdate() {
		currentTime = videoElement.currentTime;
		if (videoElement.buffered.length > 0) {
			buffered = (videoElement.buffered.end(videoElement.buffered.length - 1) / duration) * 100;
		}
	}

	function onPlay() {
		isPlaying = true;
		if (!isRemoteActionActive && !isRemoteSeeking && !$isWaitingForOthers && !localIsBuffering) {
			emitAction("play", { roomId: $currentRoomId, time: videoElement.currentTime });
		}
	}

	function onPause() {
		isPlaying = false;
		if (!isRemoteActionActive && !isRemoteSeeking && !$isWaitingForOthers && !localIsBuffering) {
			emitAction("pause", { roomId: $currentRoomId, time: videoElement.currentTime });
		}
	}

	function onSeeked() {
		const wasBuffering = localIsBuffering;
		// Clear local buffering state regardless of origin
		if (localIsBuffering) {
			localIsBuffering = false;
			emitAction("buffering_end", $currentRoomId);
		}

		// If the seek was triggered by a remote event, just clear the flag
		if (isRemoteSeeking) {
			isRemoteSeeking = false;
			return;
		}

		// Emit seek only if it was a local user action and we weren't just syncing/buffering
		if (!isRemoteActionActive && !wasBuffering) {
			emitAction("seek", { roomId: $currentRoomId, time: videoElement.currentTime });
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
		if (hls) return;
		const err = videoElement.error;
		// Code 2 (NETWORK) or 4 (SRC_NOT_SUPPORTED) often implies access issues or CORS when url is valid
		if (err && (err.code === 2 || err.code === 4)) {
			showCorsHelp = true;
			localIsBuffering = false;
			emitAction("buffering_end", $currentRoomId);
			return;
		}

		if (retryCount < MAX_RETRIES) {
			retryCount++;
			setTimeout(() => loadCurrentVideo(), 1000);
		} else {
			showError("Video load failed.");
		}
	}

	function togglePlay() {
		isPlaying ? videoElement.pause() : videoElement.play();
	}

	function handleSeek(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		const newTime = percent * duration;

		emitAction("seek", { roomId: $currentRoomId, time: newTime });
	}

	function handleSeekHover(e: MouseEvent) {
		if (!peekHls) initPeekHls();
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
		videoElement.volume = volume;
		isMuted = volume === 0;
	}

	function toggleMute() {
		isMuted = !isMuted;
		volume = isMuted ? 0 : 1;
		videoElement.volume = volume;
		videoElement.muted = isMuted;
	}

	function toggleFullscreen() {
		const wrapper = videoElement.parentElement;
		if (!document.fullscreenElement) wrapper?.requestFullscreen();
		else document.exitFullscreen();
	}

	async function togglePip() {
		try {
			if (document.pictureInPictureElement) await document.exitPictureInPicture();
			else if (videoElement?.requestPictureInPicture) await videoElement.requestPictureInPicture();
		} catch (err) {
			console.error("PiP failed:", err);
		}
	}

	function skipTime(seconds: number) {
		const newTime = Math.max(0, Math.min(duration, videoElement.currentTime + seconds));
		emitAction("seek", { roomId: $currentRoomId, time: newTime });
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
	class:hide-cursor={hideCursor}
	on:mousemove={showControlsTemp}
	on:mouseleave={() => (showControls = false)}
>
	<!-- svelte-ignore a11y-media-has-caption -->
	<video
		bind:this={videoElement}
		playsinline
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
		<div class="peek-video-container" style="display: none;">
			<!-- svelte-ignore a11y-media-has-caption -->
			<video bind:this={peekVideo} muted playsinline preload="auto"></video>
		</div>

		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="progress-bar-container"
			on:mousemove={handleSeekHover}
			on:mouseleave={() => (isHoveringSeek = false)}
			on:click={handleSeek}
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
		video {
			width: 100%;
			height: 100%;
			object-fit: contain;
			aspect-ratio: 16/9;
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
