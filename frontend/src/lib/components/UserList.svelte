<script lang="ts">
	import { flip } from "svelte/animate";
	import { fly, fade } from "svelte/transition";
	import { users } from "../stores/socket";
	export let roomId: string;

	let showCopied = false;

	function copyInviteLink() {
		const inviteLink = `${window.location.origin}${window.location.pathname}?room_id=${roomId}`;
		navigator.clipboard.writeText(inviteLink);
		showCopied = true;
		setTimeout(() => (showCopied = false), 2000);
	}
</script>

<div class="sidebar">
	<div class="room-header">
		<span class="label">Current Room</span>
		<div class="room-id-badge">
			<code>{roomId}</code>
		</div>
		<button class="copy-link-btn" on:click={copyInviteLink}>
			{showCopied ? "✓ Link Copied" : "🔗 Copy Invite Link"}
		</button>
	</div>

	<div class="user-list">
		<h3>Users ({$users.length})</h3>
		<ul>
			{#each $users as user (user.id)}
				<li
					class:buffering={user.isBuffering}
					animate:flip={{ duration: 300 }}
					in:fly={{ x: 20, duration: 300 }}
					out:fade={{ duration: 200 }}
				>
					<div class="user-avatar">{user.nickname[0].toUpperCase()}</div>
					<div class="user-info">
						<span class="nick">{user.nickname}</span>
						<span class="status">{user.isBuffering ? "Loading..." : "Ready"}</span>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</div>

<style lang="scss">
	$bg-panel: #181b21;
	$primary: #5865f2;
	$text-muted: #b9bbbe;

	.sidebar {
		background: $bg-panel;
		padding: 1rem;
		height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 2rem;

		.room-header {
			display: flex;
			flex-direction: column;
			gap: 0.8rem;
			padding-bottom: 1.5rem;
			border-bottom: 1px solid #2f3136;

			.label {
				font-size: 0.75rem;
				font-weight: 700;
				text-transform: uppercase;
				color: $text-muted;
				letter-spacing: 0.5px;
			}

			.room-id-badge {
				background: #0f1115;
				padding: 0.6rem;
				border-radius: 6px;
				border: 1px solid #333;
				code {
					color: white;
					font-family: monospace;
					font-size: 1.1rem;
					word-break: break-all;
				}
			}

			.copy-link-btn {
				background: $primary;
				color: white;
				border: none;
				padding: 0.6rem;
				border-radius: 6px;
				font-size: 0.9rem;
				font-weight: 600;
				cursor: pointer;
				transition: all 0.2s;
				text-align: center;

				&:hover {
					filter: brightness(1.1);
					transform: translateY(-1px);
				}

				&:active {
					transform: translateY(0);
				}
			}
		}

		.user-list {
			h3 {
				font-size: 0.9rem;
				text-transform: uppercase;
				color: $text-muted;
				letter-spacing: 1px;
				margin-bottom: 1rem;
			}
			ul {
				list-style: none;
				padding: 0;
				margin: 0;

				li {
					display: flex;
					align-items: center;
					gap: 10px;
					padding: 10px;
					border-radius: 6px;
					transition: 0.2s;
					margin-bottom: 5px;
					color: white;

					&:hover {
						background: rgba(255, 255, 255, 0.05);
					}

					&.buffering {
						.status {
							color: #f39c12;
						}
						.user-avatar {
							border: 2px solid #f39c12;
							animation: pulse 1s infinite;
						}
					}

					.user-avatar {
						width: 36px;
						height: 36px;
						background: $primary;
						border-radius: 50%;
						display: flex;
						justify-content: center;
						align-items: center;
						font-weight: bold;
						color: white;
					}

					.user-info {
						display: flex;
						flex-direction: column;
						.nick {
							font-weight: 500;
						}
						.status {
							font-size: 0.8rem;
							color: #43b581;
						}
					}
				}
			}
		}
	}

	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(243, 156, 18, 0.4);
		}
		70% {
			box-shadow: 0 0 0 10px rgba(243, 156, 18, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(243, 156, 18, 0);
		}
	}
</style>
