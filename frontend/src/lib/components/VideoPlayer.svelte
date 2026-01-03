<script lang="ts">
	import Hls from "hls.js";
	import { socket, roomState, isWaitingForOthers, emitAction, currentRoomId } from "../stores/socket";
	import SeekTooltip from "./player/SeekTooltip.svelte";
	import Controls from "./player/Controls.svelte";

	let videoElement: HTMLVideoElement;
	let peekVideo: HTMLVideoElement;
	let hls: Hls | null = null;
	let peekHls: Hls | null = null;
	let currentLoadedUrl = "";
	let ignoreNextEvent = false;
	let localIsBuffering = false;

	let isPlaying = false;
	let currentTime = 0;
	let duration = 0;
	let buffered = 0;
	let volume = 1;
	let isMuted = false;
	let showControls = true;
	let controlsTimeout: any;
	let seekHoverTime = 0;
	let seekHoverPercent = 0;
	let isHoveringSeek = false;

	const SERVER_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

	let currentLoadedReferer = "";
	$: if ($roomState.videoUrl) {
		if ($roomState.videoUrl !== currentLoadedUrl || $roomState.referer !== currentLoadedReferer) {
			loadVideo($roomState.videoUrl, $roomState.referer || "");
		}
	}

	$: if ($socket) {
		$socket.on("player_action", (data: { action: string; time: number }) => {
			ignoreNextEvent = true;
			if (!videoElement) return;
			const diff = Math.abs(videoElement.currentTime - data.time);
			if (diff > 0.5) videoElement.currentTime = data.time;
			if (data.action === "play") {
				videoElement.play().catch(() => {});
				isPlaying = true;
			} else if (data.action === "pause") {
				videoElement.pause();
				isPlaying = false;
			}
			setTimeout(() => {
				ignoreNextEvent = false;
			}, 500);
		});

		$socket.on("room_buffering", (isBuffering: boolean) => {
			if (isBuffering) {
				if (!videoElement.paused) {
					ignoreNextEvent = true;
					videoElement.pause();
					isPlaying = false;
					setTimeout(() => {
						ignoreNextEvent = false;
					}, 100);
				}
			} else if ($roomState.isPlaying && videoElement.paused && !localIsBuffering) {
				ignoreNextEvent = true;
				videoElement.play().catch(() => {});
				isPlaying = true;
				setTimeout(() => {
					ignoreNextEvent = false;
				}, 100);
			}
		});
	}

	function loadVideo(url: string, referer: string) {
		localIsBuffering = true;
		currentTime = 0;
		buffered = 0;
		isPlaying = false;
		if (videoElement) {
			videoElement.pause();
			videoElement.currentTime = 0;
		}
		currentLoadedUrl = url;
		currentLoadedReferer = referer;

		// USE PROXY FOR EVERYTHING to ensure CORS compliance
		let videoUrl = `${SERVER_URL}/proxy?url=${encodeURIComponent(url)}`;
		if (referer) videoUrl += `&referer=${encodeURIComponent(referer)}`;

		if (Hls.isSupported() && (url.toLowerCase().includes(".m3u8") || url.toLowerCase().includes(".txt"))) {
			if (hls) hls.destroy();
			hls = new Hls({ capLevelToPlayerSize: true });
			hls.loadSource(videoUrl);
			hls.attachMedia(videoElement);
			hls.on(Hls.Events.ERROR, (e, data) => {
				if (data.fatal) {
					localIsBuffering = false;
					currentLoadedUrl = "";
					emitAction("buffering_end", $currentRoomId);
					if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
					else hls?.destroy();
				}
			});
			if (peekHls) { peekHls.destroy(); peekHls = null; }
		} else {
			// For direct video files like .mp4, .webm, etc.
			if (hls) { hls.destroy(); hls = null; }
			videoElement.src = videoUrl;
		}
	}

	function initPeekHls() {
		if (!currentLoadedUrl || peekHls) return;
		
		let videoUrl = `${SERVER_URL}/proxy?url=${encodeURIComponent(currentLoadedUrl)}`;
		if (currentLoadedReferer) videoUrl += `&referer=${encodeURIComponent(currentLoadedReferer)}`;

		// Only use HLS for Peek if it's an HLS source
		if (Hls.isSupported() && (currentLoadedUrl.toLowerCase().includes(".m3u8") || currentLoadedUrl.toLowerCase().includes(".txt"))) {
			peekHls = new Hls({ autoStartLoad: true, maxBufferLength: 1, maxMaxBufferLength: 2, startLevel: 0 });
			peekHls.on(Hls.Events.MANIFEST_PARSED, () => { if (peekHls) peekHls.currentLevel = 0; });
			peekHls.loadSource(videoUrl);
			peekHls.attachMedia(peekVideo);
		} else if (peekVideo) {
			peekVideo.src = videoUrl;
		}
	}

	function onTimeUpdate() {
		currentTime = videoElement.currentTime;
		if (videoElement.buffered.length > 0) {
			buffered = (videoElement.buffered.end(videoElement.buffered.length - 1) / duration) * 100;
		}
	}
	function onDurationChange() {
		duration = videoElement.duration;
	}
	function onPlay() {
		isPlaying = true;
		if (!ignoreNextEvent && !$isWaitingForOthers)
			emitAction("play", { roomId: $currentRoomId, time: videoElement.currentTime });
	}
	function onPause() {
		isPlaying = false;
		if (!ignoreNextEvent && !$isWaitingForOthers && !localIsBuffering)
			emitAction("pause", { roomId: $currentRoomId, time: videoElement.currentTime });
	}
	function onSeeked() {
		if (!ignoreNextEvent) {
			emitAction("seek", { roomId: $currentRoomId, time: videoElement.currentTime });
		}
	}
	function onWaiting() {
		localIsBuffering = true;
		emitAction("buffering_start", $currentRoomId);
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

	function togglePlay() {
		isPlaying ? videoElement.pause() : videoElement.play();
	}

	function handleSeek(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		const newTime = percent * duration;
		videoElement.currentTime = newTime;
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
		const val = parseFloat((e.target as HTMLInputElement).value);
		volume = val;
		videoElement.volume = val;
		isMuted = val === 0;
	}
	function toggleMute() {
		isMuted = !isMuted;
		videoElement.muted = isMuted;
		volume = isMuted ? 0 : 1;
		videoElement.volume = volume;
	}
	function toggleFullscreen() {
		const wrapper = videoElement.parentElement;
		if (!document.fullscreenElement) wrapper?.requestFullscreen();
		else document.exitFullscreen();
	}
	async function togglePip() {
		try {
			if (document.pictureInPictureElement) await document.exitPictureInPicture();
			else if (videoElement) {
				if (typeof videoElement.requestPictureInPicture === "function")
					await videoElement.requestPictureInPicture();
				else if ((videoElement as any).webkitSetPresentationMode)
					(videoElement as any).webkitSetPresentationMode("picture-in-picture");
			}
		} catch (err) {
			console.error("PiP failed:", err);
		}
	}
	function skipTime(seconds: number) {
		if (!videoElement) return;
		const newTime = Math.max(0, Math.min(duration, videoElement.currentTime + seconds));
		videoElement.currentTime = newTime;
		emitAction("seek", { roomId: $currentRoomId, time: newTime });
	}
	function showControlsTemp() {
		showControls = true;
		clearTimeout(controlsTimeout);
		if (isPlaying && !isHoveringSeek)
			controlsTimeout = setTimeout(() => {
				showControls = false;
			}, 3000);
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
				e.preventDefault();
				togglePlay();
				showControlsTemp();
				break;
			case "k":
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

<div class="player-container" on:mousemove={showControlsTemp} on:mouseleave={() => (showControls = false)}>
	<!-- svelte-ignore a11y-media-has-caption -->
	<video
		bind:this={videoElement}
		playsinline
		on:timeupdate={onTimeUpdate}
		on:durationchange={onDurationChange}
		on:play={onPlay}
		on:pause={onPause}
		on:seeked={onSeeked}
		on:waiting={onWaiting}
		on:playing={onPlaying}
		on:canplay={onCanPlay}
		on:click={handleVideoClick}
	></video>

	{#if $isWaitingForOthers || localIsBuffering}
		<div class="loading-overlay">
			<div class="spinner"></div>
			<p>{localIsBuffering ? "Loading..." : "Waiting for others..."}</p>
		</div>
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
		video {
			width: 100%;
			height: 100%;
		}
		.loading-overlay {
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.7);
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			z-index: 10;
			pointer-events: none;
			.spinner {
				width: 50px;
				height: 50px;
				border: 5px solid rgba(255, 255, 255, 0.2);
				border-top-color: $primary;
				border-radius: 50%;
				animation: spin 1s linear infinite;
				margin-bottom: 1rem;
			}
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
	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
