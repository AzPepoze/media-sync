<script lang="ts">
	import { formatTime } from "../../utils";
	export let seekHoverPercent: number;
	export let seekHoverTime: number;
	export let peekVideo: HTMLVideoElement | null;

	$: if (peekVideo && !isNaN(seekHoverTime)) {
		const draw = () => {
			const canvas = document.getElementById("peekCanvas") as HTMLCanvasElement;
			if (canvas && peekVideo && peekVideo.readyState >= 2) {
				const ctx = canvas.getContext("2d");
				const width = 160;
				const height = 90;
				if (canvas.width !== width) canvas.width = width;
				if (canvas.height !== height) canvas.height = height;
				ctx?.drawImage(peekVideo, 0, 0, width, height);
			}
		};
		peekVideo.onseeked = draw;
		if (peekVideo.readyState >= 2) draw();
	}
</script>

<div class="seek-tooltip" style="left: {seekHoverPercent * 100}%">
	<div class="peek-frame">
		<canvas id="peekCanvas"></canvas>
	</div>
	<div class="peek-time">{formatTime(seekHoverTime)}</div>
</div>

<style lang="scss">
	.seek-tooltip {
		position: absolute;
		bottom: 25px;
		transform: translateX(-50%);
		background: #000;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.2);
		display: flex;
		flex-direction: column;
		align-items: center;
		pointer-events: none;

		.peek-frame {
			width: 160px;
			aspect-ratio: 16/9;
			background: #000;
			canvas {
				width: 100%;
				height: 100%;
				object-fit: contain;
			}

			@media (max-width: 480px) {
				width: 120px;
			}
		}

		.peek-time {
			padding: 4px 8px;
			font-size: 0.8rem;
			color: white;
			font-weight: bold;
		}
	}
</style>
