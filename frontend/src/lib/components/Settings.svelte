<script lang="ts">
	import nativeYouTubeEnabled from "../stores/settings";
	import HelpPopup from "./HelpPopup.svelte";
	import Modal from "./Modal.svelte";

	let showEmbedHelp = false;
	let showConfirmDisable = false;

	function confirmDisable() {
		nativeYouTubeEnabled.set(false);
		showConfirmDisable = false;
	}

	function cancelDisable() {
		showConfirmDisable = false;
	}

	function handleNativeToggle(e: Event) {
		const target = e.target as HTMLInputElement;
		const isTurningOff = !target.checked;

		if (isTurningOff) {
			target.checked = true;
			showConfirmDisable = true;
		} else {
			nativeYouTubeEnabled.set(true);
		}
	}
</script>

<div class="settings-container">
	<div class="settings-section">
		<h3>Video Player</h3>
		<div class="setting-item">
			<div class="native-toggle-wrapper">
				<label class="switch">
					<input type="checkbox" checked={$nativeYouTubeEnabled} on:change={handleNativeToggle} />
					<span class="slider"></span>
				</label>
				<span class="toggle-label">Native YouTube Player</span>
				<button class="help-btn" on:click={() => (showEmbedHelp = true)} title="What does this do?"
					>?</button
				>
			</div>
		</div>
	</div>
</div>
<HelpPopup show={showEmbedHelp} onClose={() => (showEmbedHelp = false)} />

<Modal show={showConfirmDisable} onClose={cancelDisable}>
	<h3>Disable native YouTube embedding?</h3>
	<p>
		Disabling the native player may improve compatibility, but the app will attempt to play a direct stream which <strong
			>typically skips YouTube ads</strong
		>.
	</p>
	<p>
		This means creators and channels <strong>may not receive ad revenue</strong> while you watch.
	</p>
	<p>Do you acknowledge and wish to proceed?</p>
	<div class="modal-actions">
		<button class="btn cancel" on:click={cancelDisable}>Cancel</button>
		<button class="btn confirm" on:click={confirmDisable}>I acknowledge — Disable</button>
	</div>
</Modal>

<style lang="scss">
	$primary: #5865f2;
	$text-muted: #b9bbbe;

	.settings-container {
		padding: 1.5rem;
		overflow-y: auto;
		height: 100%;
	}

	.settings-section {
		margin-bottom: 2rem;

		h3 {
			color: #fff;
			font-size: 0.875rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			margin-bottom: 1rem;
			color: #b9bbbe;
		}
	}

	.setting-item {
		padding: 1rem;
		background: #202225;
		border-radius: 8px;
		margin-bottom: 0.75rem;
	}

	.native-toggle-wrapper {
		display: flex;
		align-items: center;
		gap: 8px;
		color: $text-muted;
		font-size: 0.85rem;
		font-weight: 500;

		.toggle-label {
			user-select: none;
		}
	}

	.help-btn {
		background: rgba(255, 255, 255, 0.05);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.1);
		width: 22px;
		height: 22px;
		border-radius: 50%;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		font-size: 0.75rem;
		transition: all 0.2s;
		&:hover {
			background: rgba(255, 255, 255, 0.1);
			border-color: rgba(255, 255, 255, 0.2);
		}
	}

	.switch {
		position: relative;
		display: inline-block;
		width: 36px;
		height: 20px;
	}

	.switch input {
		display: none;
	}

	.slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #333;
		transition: 0.2s;
		border-radius: 20px;
	}

	.slider:before {
		position: absolute;
		content: "";
		height: 14px;
		width: 14px;
		left: 3px;
		top: 3px;
		background-color: white;
		transition: 0.2s;
		border-radius: 50%;
	}

	input:checked + .slider {
		background-color: $primary;
	}

	input:checked + .slider:before {
		transform: translateX(16px);
	}

	.modal-backdrop {
		transform: translateX(16px);
	}

	h3 {
		margin: 0 0 12px 0;
		font-size: 1.25rem;
		color: white;
	}

	p {
		margin: 0 0 16px 0;
		line-height: 1.6;
		color: #b9bbbe;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		margin-top: 24px;
	}

	.btn {
		padding: 10px 20px;
		border-radius: 6px;
		cursor: pointer;
		border: none;
		font-weight: 600;
		transition: all 0.2s;
	}

	.btn.cancel {
		background: #2f3136;
		color: #dcddde;
		&:hover {
			background: #4f545c;
			color: white;
		}
	}

	.btn.confirm {
		background: $primary;
		color: white;
		&:hover {
			filter: brightness(1.1);
		}
	}
</style>
