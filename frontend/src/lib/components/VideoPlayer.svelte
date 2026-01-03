<script lang="ts">
	import Hls from "hls.js";
	import { socket, roomState, isWaitingForOthers, emitAction, currentRoomId } from "../stores/socket";

	let videoElement: HTMLVideoElement;
	let hls: Hls | null = null;
	let currentLoadedUrl = "";
	let ignoreNextEvent = false;
	let localIsBuffering = false;

	// --- Local Player UI State ---
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

	// Watch for URL changes from store
	let currentLoadedReferer = "";
	$: if ($roomState.videoUrl) {
		if ($roomState.videoUrl !== currentLoadedUrl || $roomState.referer !== currentLoadedReferer) {
			loadVideo($roomState.videoUrl, $roomState.referer || "");
		}
	}

	// React to socket events directly for performance
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

		// Sync Waiting Logic
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
			} else {
				// Resume if room is supposed to be playing
				if ($roomState.isPlaying && videoElement.paused && !localIsBuffering) {
					ignoreNextEvent = true;
					videoElement.play().catch(() => {});
					isPlaying = true;
					setTimeout(() => {
						ignoreNextEvent = false;
					}, 100);
				}
			}
		});
	}

	function loadVideo(url: string, referer: string) {
		// Reset local state for new video
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
		let proxyUrl = `${SERVER_URL}/hls-manifest?url=${encodeURIComponent(url)}`;
		if (referer) proxyUrl += `&referer=${encodeURIComponent(referer)}`;

		if (Hls.isSupported()) {
			if (hls) hls.destroy();
			hls = new Hls();
			hls.loadSource(proxyUrl);
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
		} else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
			videoElement.src = proxyUrl;
		}
	}

	// --- Video Events ---
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
		if (!ignoreNextEvent) emitAction("seek", { roomId: $currentRoomId, time: videoElement.currentTime });
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

	// --- Control Handlers ---
	function togglePlay() {
		isPlaying ? videoElement.pause() : videoElement.play();
	}
	function handleSeek(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		videoElement.currentTime = percent * duration;
	}
	function handleSeekHover(e: MouseEvent) {
		isHoveringSeek = true;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		seekHoverPercent = (e.clientX - rect.left) / rect.width;
		seekHoverTime = seekHoverPercent * duration;
	}
	function formatTime(s: number) {
		if (isNaN(s)) return "00:00";
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
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
			if (document.pictureInPictureElement) {
				await document.exitPictureInPicture();
			} else if (videoElement) {
				if (typeof videoElement.requestPictureInPicture === "function") {
					await videoElement.requestPictureInPicture();
				} else if ((videoElement as any).webkitSetPresentationMode) {
					(videoElement as any).webkitSetPresentationMode("picture-in-picture");
				}
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
		if (isPlaying && !isHoveringSeek) {
			controlsTimeout = setTimeout(() => {
				showControls = false;
			}, 3000);
		}
	}

	function handleVideoClick() {
		if (window.innerWidth < 768) {
			showControls = !showControls;
			if (showControls) showControlsTemp();
		} else {
			togglePlay();
		}
	}
</script>

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
			<p>{localIsBuffering ? "Buffering..." : "Waiting for others..."}</p>
		</div>
	{/if}

	<div class="controls-overlay {showControls || !isPlaying ? 'visible' : ''}">
		<!-- Progress -->
		<!-- svelte-ignore a11y-click-events-have-key-events -->
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
				<div class="seek-tooltip" style="left: {seekHoverPercent * 100}%">{formatTime(seekHoverTime)}</div>
				<div class="seek-ghost" style="width: {seekHoverPercent * 100}%"></div>
			{/if}
		</div>

		<div class="controls-row">
			<div class="left-controls">
				<button class="icon-btn" on:click={togglePlay} title={isPlaying ? "Pause" : "Play"}>
					{#if isPlaying}<svg viewBox="0 0 24 24"
							><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg
						>
					{:else}<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>{/if}
				</button>

				<button class="icon-btn" on:click={() => skipTime(-5)} title="Rewind 5s">
					<svg viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M12.5,3C17.15,3 21.08,6.03 22.47,10.22L20.1,11C19.05,7.81 16.04,5.5 12.5,5.5C10.54,5.5 8.77,6.22 7.38,7.38L10,10H3V3L5.6,5.6C7.45,4 9.85,3 12.5,3Z"
						/>
						<text x="12.5" y="16" font-size="8" fill="white" font-weight="bold" text-anchor="middle"
							>5</text
						>
					</svg>
				</button>

				<button class="icon-btn" on:click={() => skipTime(5)} title="Forward 5s">
					<svg viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M11.5,3C6.85,3 2.92,6.03 1.53,10.22L3.9,11C4.95,7.81 7.96,5.5 11.5,5.5C13.46,5.5 15.23,6.22 16.62,7.38L14,10H21V3L18.4,5.6C16.55,4 14.15,3 11.5,3Z"
						/>
						<text x="11.5" y="16" font-size="8" fill="white" font-weight="bold" text-anchor="middle"
							>5</text
						>
					</svg>
				</button>

				<div class="volume-control">
					<button class="icon-btn" on:click={toggleMute}>
						{#if isMuted || volume === 0}<svg viewBox="0 0 24 24"
								><path
									fill="currentColor"
									d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"
								/></svg
							>
						{:else}<svg viewBox="0 0 24 24"
								><path
									fill="currentColor"
									d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
								/></svg
							>{/if}
					</button>
					<input type="range" min="0" max="1" step="0.1" value={volume} on:input={handleVolume} />
				</div>
				<span class="time-display">{formatTime(currentTime)} <span class="duration-total">/ {formatTime(duration)}</span></span>
			</div>
			<div class="right-controls">
				<button class="icon-btn pip-btn" on:click={togglePip} title="Picture-in-Picture">
					<svg viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"
						/></svg
					>
				</button>
				<button class="icon-btn" on:click={toggleFullscreen} title="Fullscreen">
					<svg viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
						/></svg
					>
				</button>
			</div>
		</div>
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
					position: relative;
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
				.seek-tooltip {
					position: absolute;
					bottom: 15px;
					transform: translateX(-50%);
					background: #000;
					padding: 4px 8px;
					border-radius: 4px;
					font-size: 0.8rem;
					color: white;
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
			.controls-row {
				display: flex;
				justify-content: space-between;
				align-items: center;
				flex-wrap: nowrap; /* Keep items in one line */
				gap: 5px;

				.left-controls,
				.right-controls {
					display: flex;
					align-items: center;
					gap: 12px;

					@media (max-width: 600px) {
						gap: 6px;
					}
				}

				.right-controls {
					flex-shrink: 0; /* Never hide the right side */
					
					.pip-btn {
						@media (max-width: 400px) {
							display: none; /* Hide PiP to save space for Fullscreen */
						}
					}
				}

				.icon-btn {
					background: none;
					border: none;
					color: white;
					cursor: pointer;
					padding: 0;
					width: 28px;
					height: 28px;
					opacity: 0.8;
					transition: 0.2s;
					flex-shrink: 0;

					@media (max-width: 480px) {
						width: 24px;
						height: 24px;
					}

					&:hover {
						opacity: 1;
						transform: scale(1.1);
					}

					svg {
						width: 100%;
						height: 100%;
					}
				}

				.volume-control {
					display: flex;
					align-items: center;
					gap: 5px;

					input[type="range"] {
						width: 60px;
						accent-color: white;
						cursor: pointer;

						@media (max-width: 500px) {
							width: 40px;
						}

						@media (max-width: 380px) {
							display: none;
						}
					}
				}

				.time-display {
					font-size: 0.85rem;
					font-variant-numeric: tabular-nums;
					white-space: nowrap;
					opacity: 0.9;
					color: white;

					@media (max-width: 480px) {
						font-size: 0.7rem;
					}

					@media (max-width: 350px) {
						.duration-total { display: none; }
					}
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
