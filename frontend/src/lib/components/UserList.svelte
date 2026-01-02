<script lang="ts">
	import { users } from "../stores/socket";
	export let roomId: string;
</script>

<div class="sidebar">
	<h2>Room: {roomId}</h2>
	<div class="user-list">
		<h3>Users ({$users.length})</h3>
		<ul>
			{#each $users as user}
				<li class:buffering={user.isBuffering}>
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
		border-left: 1px solid #2f3136;
		padding: 1.5rem;
		height: 100%;
		overflow-y: auto;
		box-sizing: border-box;

		h2 {
			font-size: 1.2rem;
			margin-bottom: 2rem;
			color: $text-muted;
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
