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
	import { getYoutubeId, getProxyUrl, isHlsSource, checkIsMobile } from "../utils/media";
	import { HTML5Player, YouTubePlayer, type BasePlayer } from "../utils/players";
	import Hls from "hls.js";
	import SeekTooltip from "./player/SeekTooltip.svelte";
	import Controls from "./player/Controls.svelte";
	import LoadingOverlay from "./player/LoadingOverlay.svelte";
	import ErrorOverlay from "./player/ErrorOverlay.svelte";
	import NoVideoOverlay from "./player/NoVideoOverlay.svelte";
	import CorsHelpOverlay from "./player/CorsHelpOverlay.svelte";
	import YoutubeEmbed from "./player/YoutubeEmbed.svelte";
	import settings from "../stores/settings";
	import { SERVER_URL } from "../stores/socket";

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
	let cachedResolvedUrl = "";
	let cachedResolvedReferer = "";
	let lastNativeYouTubeEnabled: boolean | undefined = undefined;
	let lastUseProxy: boolean | undefined = undefined;
	let isLoading = false;

	// Sync State
	let isRemoteSeeking = false;
	let isSeeking = false;
	let localIsBuffering = false;
	let lastBufferingEnd = 0;
	let lastServerAction = 0;
	let hasEverPlayed = false;

	// Error State
	let hasError = false;
	let showCorsHelp = false;
	let errorMessage = "";
	let retryCount = 0;
	let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
	const MAX_RETRIES = 2;

	// Proxy mode - enabled when user chooses to use proxy for CORS issues
	let forceProxyMode = false;

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
			await loadVideo($roomState.videoUrl, stateReferer, targetTime, $roomState.isPlaying, $settings.useProxy);
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
				const shouldBePlaying = $roomState.isPlaying && !$isWaitingForOthers;
				const isActuallyPlaying = player.isPlaying;
				if (!shouldBePlaying && isActuallyPlaying) {
					console.log("[Sync] Pausing playback (waiting for others)");
					player.pause(true);
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
				player.play(true);
			} else if (!shouldBePlaying && isActuallyPlaying) {
				console.log("[Sync] Pausing playback (waiting or paused)");
				player.pause(true);
			}
		}
	}

	async function loadVideo(
		url: string,
		referer: string,
		startTime = 0,
		shouldPlay = false,
		useProxy = false,
		isRetry = false
	) {
		// Prevent concurrent loading
		if (isLoading) {
			console.log("[Player] Already loading, skipping...");
			return;
		}
		isLoading = true;

		// Cancel any pending retry
		if (retryTimeoutId) {
			clearTimeout(retryTimeoutId);
			retryTimeoutId = null;
		}

		localIsBuffering = true;
		emitBufferingStart();

		// Reset States (only reset retryCount on fresh load, not retry)
		hasError = false;
		showCorsHelp = false;
		errorMessage = "";
		currentTime = startTime;
		buffered = 0;
		if (!isRetry) {
			retryCount = 0;
			cachedResolvedUrl = "";
			cachedResolvedReferer = "";
			hasEverPlayed = false;
		}

		// Store the original URL from room state (not the resolved one)
		currentLoadedUrl = url;
		currentLoadedReferer = referer;

		// Update proxy mode if specified
		if (useProxy) {
			forceProxyMode = true;
		}

		let ytId = getYoutubeId(url);
		let resolvedUrl = url;
		let resolvedReferer = referer;

		// If user disabled native YouTube embed, attempt to resolve a direct stream first
		if (ytId && !$settings.nativeYouTubeEnabled) {
			// Use cached resolved URL on retry to avoid spamming resolve endpoint
			if (isRetry && cachedResolvedUrl) {
				console.log("[Player] Using cached resolved URL for retry");
				resolvedUrl = cachedResolvedUrl;
				resolvedReferer = cachedResolvedReferer;
				ytId = getYoutubeId(resolvedUrl);
			} else {
				try {
					console.log("[Player] Native YouTube disabled - attempting to resolve direct stream...");
					const res = await fetch(
						`${SERVER_URL}/resolve?url=${encodeURIComponent(url)}&roomId=${encodeURIComponent($currentRoomId || "")}`
					);
					if (res.ok) {
						const json = await res.json();
						if (json && json.url) {
							resolvedUrl = json.url;
							if (json.referer) resolvedReferer = json.referer;
							cachedResolvedUrl = resolvedUrl;
							cachedResolvedReferer = resolvedReferer;
							ytId = getYoutubeId(resolvedUrl); // probably null now
							console.log("[Player] Resolved URL:", resolvedUrl);
						}
					} else {
						console.warn("[Player] Resolve endpoint failed, status:", res.status);
					}
				} catch (e) {
					console.warn("[Player] Resolve attempt failed:", e);
				}
			}
		}

		try {
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
					// player.setPlayingChangeCallback(() => {
					// 	// Force reactivity update
					// 	player = player;
					// });
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
							// Ignore errors if we've already switched to YouTube mode
							if (isYoutube || $settings.nativeYouTubeEnabled) {
								console.log("[Player] Ignoring HLS error - already switched to native YouTube");
								return;
							}

							// Check if this is a CORS-related error
							const isCorsError = details === "manifestLoadError" || details === "fragLoadError";

							if (isCorsError) {
								// Don't show CORS help for YouTube/googlevideo streams - they work without extension
								const isGoogleVideo =
									resolvedUrl.includes("googlevideo.com") ||
									resolvedUrl.includes("youtube.com") ||
									resolvedUrl.includes("youtu.be");
								if (isGoogleVideo) {
									// For YouTube resolved streams, just show generic error and retry
									console.log(
										"[Player] YouTube stream error, will retry... (attempt",
										retryCount + 1,
										"/",
										MAX_RETRIES + 1,
										")"
									);
									if (retryCount < MAX_RETRIES) {
										retryCount++;
										// Get a fresh resolved URL on retry (YouTube URLs expire)
										cachedResolvedUrl = ""; // Clear cache to get fresh URL
										retryTimeoutId = setTimeout(() => {
											retryTimeoutId = null;
											// Don't retry if we've switched to native YouTube
											if ($settings.nativeYouTubeEnabled || isYoutube) {
												console.log(
													"[Player] Skipping retry - native YouTube enabled"
												);
												isLoading = false;
												return;
											}
											isLoading = false;
											loadVideo(
												currentLoadedUrl,
												currentLoadedReferer,
												0,
												false,
												$settings.useProxy,
												true
											);
										}, 2000);
										return;
									}
									console.log(
										"[Player] YouTube stream failed after",
										MAX_RETRIES + 1,
										"attempts"
									);

									if (retryTimeoutId) {
										clearTimeout(retryTimeoutId);
										retryTimeoutId = null;
									}

									showCorsHelp = true;
									localIsBuffering = true;
									emitBufferingStart();
								} else {
									showCorsHelp = true;
									localIsBuffering = true;
									emitBufferingStart();
								}
							} else if (fatal) {
								showError(`Video Error: ${details}`);
							}
						},
					});
					// player.setPlayingChangeCallback(() => {
					// 	// Force reactivity update
					// 	player = player;
					// });
				}

				// Load Content
				if (player instanceof HTML5Player) {
					const socketId = $socket?.id || "";
					await player.load(
						resolvedUrl,
						resolvedReferer,
						startTime,
						shouldPlay,
						$currentRoomId,
						socketId,
						forceProxyMode
					);
				}
			}
		} finally {
			isLoading = false;
		}
	}

	//-------------------------------------------------------
	// Socket Listeners & Reactive Statements
	//-------------------------------------------------------
	$: if ($roomState) {
		console.log("[VideoPlayer] roomState changed, loading current video...");
		loadCurrentVideo();
	}
	$: if ($isWaitingForOthers !== undefined) {
		console.log("[VideoPlayer] isWaitingForOthers changed, loading current video...");
		loadCurrentVideo();
	}

	// Watch for settings toggle - force reload for YouTube videos
	$: {
		const nativeChanged =
			lastNativeYouTubeEnabled !== undefined && lastNativeYouTubeEnabled !== $settings.nativeYouTubeEnabled;
		const proxyChanged = lastUseProxy !== undefined && lastUseProxy !== $settings.useProxy;

		if (nativeChanged || proxyChanged) {
			localIsBuffering = true;
			emitBufferingStart();

			const ytId = $roomState?.videoUrl ? getYoutubeId($roomState.videoUrl) : null;
			const shouldReload = ytId || proxyChanged;

			if (shouldReload) {
				console.log("[Player] Settings changed, reloading video...");
				// Cancel any pending retries
				if (retryTimeoutId) {
					clearTimeout(retryTimeoutId);
					retryTimeoutId = null;
				}
				// Force reload by clearing current URL and resetting loading state
				currentLoadedUrl = "";
				cachedResolvedUrl = "";
				cachedResolvedReferer = "";
				isLoading = false;
				retryCount = 0;
				if (player) {
					player.destroy();
					player = null;
				}
				loadCurrentVideo();
			}
		}
		lastNativeYouTubeEnabled = $settings.nativeYouTubeEnabled;
		lastUseProxy = $settings.useProxy;
	}

	// Helper: sync time if drift is significant
	function syncTimeIfNeeded(targetTime: number) {
		if (!player) return;
		const currentPlayerTime = player.getCurrentTime();
		const diff = Math.abs(currentPlayerTime - targetTime);
		if (diff > 0.5) {
			console.log("[Player] Syncing time, diff:", diff.toFixed(2));
			player.seek(targetTime);
		}
	}

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
				player.seek(data.time, true);
				return;
			}

			// For pause - pause and sync time
			if (data.action === "pause") {
				console.log("[Player] Pause action received, pausing player");
				player.pause(true);
				syncTimeIfNeeded(data.time);
				return;
			}

			// For play action - sync time and play
			if (data.action === "play") {
				console.log("[Player] Play action received");
				lastServerAction = Date.now();
				// Clear seeking flags when play is received
				isSeeking = false;
				isRemoteSeeking = false;
				syncTimeIfNeeded(data.time);
				player.play(true);
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
			// player.setPlayingChangeCallback(() => {
			// 	// Force reactivity update
			// 	player = player;
			// });
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

	async function onPlay() {
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

		// Mark that video has played at least once (for buffering detection)
		hasEverPlayed = true;

		// Check if this was a silent action (sync/server-initiated)
		const wasSilent = player?.isSilentAction ?? false;
		if (player) {
			player.isSilentAction = false;
			player.updatePlayingState(true);
		}

		// Handle YouTube buffering recovery
		if (isYoutube && localIsBuffering) {
			console.log("[Youtube] Recovered from Buffering -> Playing");
			localIsBuffering = false;
			emitBufferingEnd(); // Tell server we're done buffering
			// Don't return - continue to handle the play event normally
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

		if (player) {
			console.log("[Player] Pause locally waiting...");
			await player.pause(true);
			console.log("[Player] Paused, now emitting play to server");
		}

		// User clicked play - emit to server and pause locally
		// Wait for server to send play action back to actually start playing
		const t = player ? player.getCurrentTime() : 0;
		console.log(
			"[Player] User play action, emitting at time:",
			t.toFixed(2),
			"- pausing locally to wait for server"
		);
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

		if (player?.isSilentAction) {
			console.log("[Player] Silent seek action, not emitting");
			player.isSilentAction = false;
		}

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
		// Don't trigger room-level buffering during initial video load
		// The initial load is already tracked by localIsBuffering from loadVideo()
		if (!hasEverPlayed) {
			console.log("[Player] Waiting during initial load, not emitting buffering_start to room");
			localIsBuffering = true;
			return;
		}
		// Don't emit buffering if we're not supposed to be playing
		// This prevents false buffering signals when user clicks play and we pause to wait for server
		if (!$roomState.isPlaying) {
			console.log("[Player] Waiting but room is paused, not emitting buffering_start");
			localIsBuffering = true;
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

		// Check if this is a YouTube/Google video stream (check both original and cached URL)
		const isGoogleVideo = currentLoadedUrl.includes("googlevideo.com");

		if (err && (err.code === 2 || err.code === 4)) {
			// Only show CORS help for non-YouTube sources
			if (!isGoogleVideo) {
				showCorsHelp = true;
				localIsBuffering = false;
				emitBufferingEnd();
				return;
			}
			// For YouTube, fall through to retry logic
		}

		if (retryCount < MAX_RETRIES) {
			retryCount++;
			console.log(`[Player] Retrying load (${retryCount}/${MAX_RETRIES})...`);
			// Clear cached URL to get fresh one on retry (YouTube URLs expire)
			if (isGoogleVideo) {
				cachedResolvedUrl = "";
			}
			setTimeout(() => {
				isLoading = false;
				loadVideo(currentLoadedUrl, currentLoadedReferer, 0, false, $settings.useProxy, true);
			}, 2000);
		} else {
			// For YouTube sources, fall back to native embed instead of showing error
			if (isGoogleVideo) {
				console.log("[Player] YouTube stream failed, showing help/proxy option");
				isLoading = false;
				cachedResolvedUrl = "";
				showCorsHelp = true;
				localIsBuffering = false;
				emitBufferingEnd();
			} else {
				showError("Video load failed.");
			}
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
			player.pause(true);
		}

		// Seek locally
		if (player) {
			console.log("[Seek] Executing local player.seek(", time.toFixed(2), ")");
			player.seek(time);
		}

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
		const socketId = $socket?.id || "";
		const videoUrl = getProxyUrl(currentLoadedUrl, currentLoadedReferer, $currentRoomId, socketId);
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

	function handleVideoClick(e?: Event) {
		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}

		const isMobile = checkIsMobile();
		console.log("[UI] Video clicked", isMobile);
		if (isMobile) {
			showControls = !showControls;
			if (showControls) {
				showControlsTemp();
			} else {
				clearTimeout(controlsTimeout);
			}
		} else {
			togglePlay();
		}
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
	{#if $settings.nativeYouTubeEnabled && isYoutube && getYoutubeId(currentLoadedUrl)}
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
		</div>
	{:else}
		<!-- HTML5 Video Player -->
		<!-- svelte-ignore a11y-media-has-caption -->
		<video
			bind:this={videoElement}
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
			on:error={handleVideoError}
		></video>
	{/if}

	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="video-click-overlay" on:click={handleVideoClick}></div>

	{#if $isVideoChanging || ($roomState?.videoUrl && (localIsBuffering || $isWaitingForOthers))}
		<LoadingOverlay isVideoChanging={$isVideoChanging} {localIsBuffering} />
	{:else if !$roomState?.videoUrl}
		<NoVideoOverlay />
	{/if}

	{#if showCorsHelp}
		<CorsHelpOverlay
			onRetry={() => {
				showCorsHelp = false;
				loadVideo(currentLoadedUrl, currentLoadedReferer);
			}}
			onUseProxy={() => {
				showCorsHelp = false;
				loadVideo(currentLoadedUrl, currentLoadedReferer, 0, false, true);
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

		.youtube-wrapper {
			position: relative; // Needs to be relative for overlay absolute
		}

		.video-click-overlay {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
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
			pointer-events: none;
			user-select: none;
			&.visible {
				opacity: 1;
				pointer-events: auto;
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
