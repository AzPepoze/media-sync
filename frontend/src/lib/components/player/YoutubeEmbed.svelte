<script lang="ts">
	import { sleep } from "$lib/utils";
	import { onMount, onDestroy, createEventDispatcher } from "svelte";

	export let videoId: string;
	export let startTime: number = 0;
	export let shouldPlay: boolean = false;
	export let volume: number = 1;
	export let isMuted: boolean = false;

	const dispatch = createEventDispatcher();
	let player: any = null;
	let timeInterval: ReturnType<typeof setInterval>;
	let currentState: number = -1;
	let isReady = false;
	let isEnded = false;
	let isBuffering = true;
	let seeking = false;

	// --- Public Methods ---
	export function play() {
		isEnded = false;
		if (player && isReady) player.playVideo();
	}

	export function pause() {
		if (player && isReady) player.pauseVideo();
	}

	export async function seekTo(seconds: number) {
		isEnded = false;
		if (player && isReady) player.seekTo(seconds, true);
		if (!shouldPlay) {
			dispatch("canplay");
			return;
		}
		while (currentState != 3) {
			await sleep(100);
		}
		//@ts-ignore
		while (currentState != 2) {
			await sleep(100);
		}
		dispatch("canplay");
	}

	export function setVolume(vol: number) {
		if (player && isReady) player.setVolume(vol * 100);
	}

	export function mute() {
		if (player && isReady) player.mute();
	}

	export function unMute() {
		if (player && isReady) player.unMute();
	}

	export function getCurrentTime(): number {
		return player && isReady ? player.getCurrentTime() : 0;
	}

	export function getDuration(): number {
		return player && isReady ? player.getDuration() : 0;
	}

	export function getPlayerState(): number {
		return player && isReady ? player.getPlayerState() : -1;
	}

	export function getVideoLoadedFraction(): number {
		return player && isReady ? player.getVideoLoadedFraction() : 0;
	}

	// --- Internal Helpers ---
	function handleReplay() {
		isEnded = false;
		play();
	}

	// --- Logic ---
	function loadYoutubeApi() {
		return new Promise<void>((resolve) => {
			if ((window as any).YT && (window as any).YT.Player) {
				resolve();
				return;
			}
			// Check if script is already added but not loaded
			if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
				const existingCallback = (window as any).onYouTubeIframeAPIReady;
				(window as any).onYouTubeIframeAPIReady = () => {
					if (existingCallback) existingCallback();
					resolve();
				};
				return;
			}

			const tag = document.createElement("script");
			tag.src = "https://www.youtube.com/iframe_api";
			document.head.appendChild(tag);

			(window as any).onYouTubeIframeAPIReady = () => resolve();
		});
	}

	async function initPlayer() {
		await loadYoutubeApi();

		// @ts-ignore
		player = new YT.Player("youtube-player-embed", {
			height: "100%",
			width: "100%",
			videoId: videoId,
			playerVars: {
				autoplay: shouldPlay ? 1 : 0,
				controls: 0,
				rel: 0, // Minimize recommendations
				modestbranding: 1, // Minimal logo
				iv_load_policy: 3, // Hide annotations
				disablekb: 1, // Disable keyboard controls
				fs: 0, // Hide fullscreen button
				playsinline: 1, // iOS inline playback
				start: Math.floor(startTime),
			},
			events: {
				onReady: (event: any) => {
					isReady = true;
					player.setVolume(volume * 100);
					if (isMuted) player.mute();
					else player.unMute();

					dispatch("ready", { duration: player.getDuration() });
					if (shouldPlay) player.playVideo();

					timeInterval = setInterval(() => {
						if (player && isReady) {
							dispatch("timeupdate", {
								currentTime: player.getCurrentTime(),
								duration: player.getDuration(),
								buffered: player.getVideoLoadedFraction() * 100,
							});
						}
					}, 500);
				},
				onStateChange: (event: any) => {
					// YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3
					if (event.data === 1 || event.data === 2 || event.data === 5) {
						isEnded = false;
					}

					console.log("YouTube Player State Changed:", event.data);
					currentState = event.data;
					switch (event.data) {
						case 1:
							dispatch("play");
							break;
						case 2:
							isBuffering = false;
							dispatch("pause");
							break;
						case 3:
							isBuffering = true;
							// dispatch("waiting");
							break;
						case 0:
							isEnded = true;
							dispatch("ended");
							break;
					}
				},
				onError: (e: any) => {
					dispatch("error", e.data);
				},
			},
		});
	}

	// --- Reactivity ---
	$: if (player && isReady && videoId) {
		const currentId = player.getVideoData()?.video_id;
		if (currentId !== videoId) {
			player.loadVideoById({ videoId, startSeconds: startTime });
			if (!shouldPlay) player.pauseVideo();
		}
	}

	onMount(() => {
		initPlayer();
	});

	onDestroy(() => {
		if (timeInterval) clearInterval(timeInterval);
		if (player && typeof player.destroy === "function") {
			player.destroy();
		}
	});
</script>

<div class="embed-wrapper">
	<div id="youtube-player-embed" class="yt-embed"></div>
	{#if isEnded}
		<div class="end-cover">
			<button class="replay-btn" on:click={handleReplay}> ↻ Replay </button>
		</div>
	{/if}
</div>

<style>
	.embed-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
	}
	.yt-embed {
		width: 100%;
		height: 100%;
		background: black;
	}
	.end-cover {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: black;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.replay-btn {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		padding: 10px 20px;
		border-radius: 5px;
		font-size: 1.2rem;
		cursor: pointer;
	}
	.replay-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}
</style>
