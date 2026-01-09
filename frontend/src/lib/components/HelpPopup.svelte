<script lang="ts">
	import Modal from "./Modal.svelte";

	export let show = false;
	export let onClose: () => void;
</script>

<Modal {show} {onClose}>
	<h3>Native YouTube Embedding</h3>
	<div class="popup-body">
		<p>
			<strong>Enabled:</strong> Uses the standard YouTube iframe API (includes ads).
		</p>
		<p>
			<strong>Disabled:</strong> Attempts to play a direct stream which often
			<strong>skips ads</strong>.
		</p>
		<p class="note">
			<em>Note: Disabling may prevent creators from earning ad revenue.</em>
		</p>
	</div>
	<div class="popup-actions">
		<button class="btn-ok" on:click={onClose}>OK</button>
	</div>
</Modal>

<style lang="scss">
	h3 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: white;
	}

	.popup-body {
		margin-bottom: 1.5rem;

		p {
			color: #b9bbbe;
			font-size: 0.95rem;
			line-height: 1.6;
			margin: 0 0 0.75rem 0;

			&:last-child {
				margin-bottom: 0;
			}

			strong {
				color: #dcddde;
			}
		}

		.note {
			margin-top: 1rem;
			padding-top: 1rem;
			border-top: 1px solid rgba(255, 255, 255, 0.1);
			font-size: 0.875rem;
		}
	}

	.popup-actions {
		display: flex;
		justify-content: flex-end;

		.btn-ok {
			padding: 10px 20px;
			background: #5865f2;
			color: white;
			border: none;
			border-radius: 6px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.2s;

			&:hover {
				filter: brightness(1.1);
			}

			&:active {
				transform: scale(0.98);
			}
		}
	}
</style>
