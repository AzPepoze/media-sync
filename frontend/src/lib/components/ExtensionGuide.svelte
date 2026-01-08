<script lang="ts">
	// Reusable component for extension installation instructions
</script>

<div class="instruction-columns">
	<!-- Chromium Column -->
	<div class="browser-col">
		<div class="col-header">
			<img
				src="https://upload.wikimedia.org/wikipedia/commons/e/e1/Google_Chrome_icon_%28February_2022%29.svg"
				alt="Chrome"
			/>
			<span>Chromium<br />(Chrome, Edge, etc.)</span>
		</div>
		<a
			href="https://chromewebstore.google.com/detail/cors-unblock/lfhmikememgdcahcdlaciloancbhjino"
			target="_blank"
			class="ext-btn"
		>
			Download Extension
		</a>
		<div class="steps">
			<div class="step">1. Click <span class="highlight">CORS Unblock</span> icon.</div>
			<div class="step">2. You can see the popup</div>
			<div class="step">3. Click <span class="highlight">"Start"</span> in bottom</div>
			<div class="step">4. Minimize the UI</div>
			<div class="step">5. Click <span class="highlight">"I'm ready, Retry"</span></div>
		</div>
	</div>

	<!-- Firefox Column -->
	<div class="browser-col">
		<div class="col-header">
			<img src="https://upload.wikimedia.org/wikipedia/commons/a/a0/Firefox_logo%2C_2019.svg" alt="Firefox" />
			<span>Firefox</span>
		</div>
		<a href="https://addons.mozilla.org/en-US/firefox/addon/cors-unblock/" target="_blank" class="ext-btn">
			Download Extension
		</a>
		<div class="steps">
			<div class="step">1. Click <span class="highlight">CORS Unblock</span> icon.</div>
			<div class="step">2. Make sure it is <span class="highlight">Colored</span></div>
			<div class="step">3. Ready to watch</div>
			<div class="step">4. Click <span class="highlight">"I'm ready, Retry"</span></div>
		</div>
	</div>
</div>

<div class="help-text security-warning">
	<small
		>⚠️ <strong>Important:</strong> Please <u>disable the extension</u> after using this site to keep your browsing
		secure.</small
	>
</div>

<style lang="scss">
	.instruction-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		text-align: left;
		width: 100%;
		margin-bottom: 1.5rem;

		@media (max-width: 600px) {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.browser-col {
			background: rgba(255, 255, 255, 0.05);
			padding: 1.2rem;
			border-radius: 10px;
			border: 1px solid rgba(255, 255, 255, 0.05);
			display: flex;
			flex-direction: column;
			gap: 0.8rem;

			.col-header {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				font-weight: 700;
				color: white;
				margin-bottom: 0.2rem;
				font-size: 0.95rem;
				justify-content: center;

				img {
					width: 24px;
					height: 24px;
				}
			}

			.ext-btn {
				display: block;
				background: rgba(255, 255, 255, 0.1);
				color: white;
				text-decoration: none;
				padding: 0.6rem;
				border-radius: 6px;
				text-align: center;
				font-weight: 600;
				font-size: 0.9rem;
				transition: background 0.2s;
				border: 1px solid rgba(255, 255, 255, 0.1);

				&:hover {
					background: rgba(255, 255, 255, 0.2);
				}
			}

			.steps {
				font-size: 0.85rem;
				color: #ddd;
				display: flex;
				flex-direction: column;
				gap: 0.4rem;
				background: rgba(0, 0, 0, 0.2);
				padding: 0.8rem;
				border-radius: 6px;

				.step {
					display: flex;
					gap: 0.3rem;
				}
				
				strong,
				.highlight {
					color: #ffb74d;
				}
			}
		}
	}

	.help-text {
		text-align: center;

		&.security-warning {
			color: #ff6b6b;
			background: rgba(255, 107, 107, 0.1);
			padding: 0.8rem;
			border-radius: 8px;
			border: 1px solid rgba(255, 107, 107, 0.3);
			max-width: 600px;
			margin: 20px auto;

			small {
				font-size: 0.9rem;
				display: block;
			}
		}
	}
</style>
