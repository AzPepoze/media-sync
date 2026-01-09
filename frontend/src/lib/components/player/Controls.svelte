<script lang="ts">
	import { fade, scale } from "svelte/transition";
	import { formatTime } from "../../utils";

	export let isPlaying: boolean;
	export let currentTime: number;
	export let duration: number;
	export let volume: number;
	export let isMuted: boolean;
	export let togglePlay: () => void;
	export let skipTime: (s: number) => void;
	export let toggleMute: () => void;
	export let handleVolume: (e: Event) => void;
	export let togglePip: () => Promise<void>;
	export let toggleFullscreen: () => void;
</script>

<div class="controls-row" in:fade={{ duration: 300 }}>
	<div class="left-controls">
		<button class="icon-btn play-btn" on:click={togglePlay} title={isPlaying ? "Pause" : "Play"}>
			{#key isPlaying}
				<div in:scale={{ duration: 200, start: 0.5 }}>
					{#if isPlaying}
						<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
					{:else}
						<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>
					{/if}
				</div>
			{/key}
		</button>

		<button class="icon-btn skip-btn" on:click={() => skipTime(-5)} title="Rewind 5s">
			<svg viewBox="0 0 24 24">
				<path
					fill="currentColor"
					d="M12.5,3C17.15,3 21.08,6.03 22.47,10.22L20.1,11C19.05,7.81 16.04,5.5 12.5,5.5C10.54,5.5 8.77,6.22 7.38,7.38L10,10H3V3L5.6,5.6C7.45,4 9.85,3 12.5,3Z"
				/>
				<text x="12.5" y="16" font-size="8" fill="white" font-weight="bold" text-anchor="middle">5</text>
			</svg>
		</button>

		<button class="icon-btn skip-btn" on:click={() => skipTime(5)} title="Forward 5s">
			<svg viewBox="0 0 24 24">
				<path
					fill="currentColor"
					d="M11.5,3C6.85,3 2.92,6.03 1.53,10.22L3.9,11C4.95,7.81 7.96,5.5 11.5,5.5C13.46,5.5 15.23,6.22 16.62,7.38L14,10H21V3L18.4,5.6C16.55,4 14.15,3 11.5,3Z"
				/>
				<text x="11.5" y="16" font-size="8" fill="white" font-weight="bold" text-anchor="middle">5</text>
			</svg>
		</button>

		<div class="volume-control">
			<button class="icon-btn" on:click={toggleMute}>
				{#key isMuted || volume === 0}
					<div in:scale={{ duration: 200, start: 0.5 }}>
						{#if isMuted || volume === 0}
							<svg viewBox="0 0 24 24"
								><path
									fill="currentColor"
									d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"
								/></svg
							>
						{:else}
							<svg viewBox="0 0 24 24"
								><path
									fill="currentColor"
									d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
								/></svg
							>
						{/if}
					</div>
				{/key}
			</button>
			<input type="range" min="0" max="1" step="0.1" value={volume} on:input={handleVolume} />
		</div>
		<span class="time-display">
			{formatTime(currentTime)} <span class="duration-total">/ {formatTime(duration)}</span>
		</span>
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
		<button class="icon-btn fullscreen-btn" on:click={toggleFullscreen} title="Fullscreen">
			<svg viewBox="0 0 24 24"
				><path
					fill="currentColor"
					d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
				/></svg
			>
		</button>
	</div>
</div>

<style lang="scss">
	.controls-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: nowrap;
		gap: 5px;
		user-select: none;

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
			flex-shrink: 0;
			.pip-btn {
				@media (max-width: 400px) {
					display: none;
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
			transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;

			@media (max-width: 480px) {
				width: 24px;
				height: 24px;
			}
			&:hover {
				opacity: 1;
				transform: scale(1.2);
				filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.3));
			}
			&:active {
				transform: scale(0.9);
			}
			svg {
				width: 100%;
				height: 100%;
			}
		}

		.skip-btn:active {
			transform: rotate(20deg) scale(0.9);
			&[title*="Rewind"] {
				transform: rotate(-20deg) scale(0.9);
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
				opacity: 0.7;
				transition: opacity 0.2s;
				&:hover {
					opacity: 1;
				}
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
			opacity: 0.8;
			color: white;
			transition: opacity 0.2s;
			&:hover {
				opacity: 1;
			}
			@media (max-width: 480px) {
				font-size: 0.7rem;
			}
			@media (max-width: 350px) {
				.duration-total {
					display: none;
				}
			}
		}
	}
</style>