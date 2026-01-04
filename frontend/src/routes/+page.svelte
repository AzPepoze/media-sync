<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { isJoined, initSocket, cleanupSocket, currentRoomId, leaveRoom } from "$lib/stores/socket";
	import WelcomeScreen from "$lib/components/WelcomeScreen.svelte";
	import VideoPlayer from "$lib/components/VideoPlayer.svelte";
	import UserList from "$lib/components/UserList.svelte";
	import UrlBar from "$lib/components/UrlBar.svelte";
	import CollectionManager from "$lib/components/CollectionManager.svelte";

	let activeTab: "users" | "collections" = "users";
	let showSidebar = false;

	onMount(() => {
		const savedRoomId = localStorage.getItem("roomId");
		const savedNickname = localStorage.getItem("nickname");

		// Only init socket if we were previously in a room (for auto-rejoin)
		if (savedRoomId && savedNickname) {
			initSocket();
		}
	});

	onDestroy(() => {
		cleanupSocket();
	});

	function goHome() {
		leaveRoom();
	}

	function toggleSidebar() {
		showSidebar = !showSidebar;
	}
</script>

{#if !$isJoined}
	<WelcomeScreen />
{:else}
	<div class="app-layout">
		<div class="player-area">
			<div class="mobile-header">
				<button class="hamburger" on:click={toggleSidebar} aria-label="Toggle Menu">
					<svg viewBox="0 0 24 24" width="24" height="24">
						<path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
					</svg>
				</button>
				<div class="mobile-brand" on:click={goHome}>
					<img src="/logo.png" alt="Media Sync" />
					<span>Media Sync</span>
				</div>
			</div>
			<VideoPlayer />
			<UrlBar />
		</div>

		{#if showSidebar}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="sidebar-overlay" on:click={toggleSidebar}></div>
		{/if}

		<div class="sidebar-area" class:mobile-open={showSidebar}>
			<div class="sidebar-header-wrapper">
				<div class="sidebar-header">
					<img src="/logo.png" alt="Media Sync" class="mini-logo" />
					<div class="header-text">
						<span class="brand-name">Media Sync</span>
						<span class="room-id-display">Room: {$currentRoomId}</span>
					</div>
				</div>
				<button class="leave-room-btn" on:click={goHome} title="Leave Room">
					<svg viewBox="0 0 24 24" width="18" height="18">
						<path fill="currentColor" d="M14.08,15.59L16.67,13H7V11H16.67L14.08,8.41L15.5,7L20.5,12L15.5,17L14.08,15.59M19,3A2,2 0 0,1 21,5V9.67L19,7.67V5H5V19H19V16.33L21,14.33V19A2,2 0 0,1 19,21H5C3.89,21 3,20.1 3,19V5C3,3.89 3.89,3 5,3H19Z" />
					</svg>
					<span>Leave</span>
				</button>
				<button class="close-sidebar-btn" on:click={toggleSidebar} aria-label="Close Menu">
					<svg viewBox="0 0 24 24" width="20" height="20">
						<path
							fill="currentColor"
							d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
						/>
					</svg>
				</button>
			</div>
			<div class="sidebar-tabs">
				<button class:active={activeTab === "users"} on:click={() => (activeTab = "users")}>Users</button>
				<button class:active={activeTab === "collections"} on:click={() => (activeTab = "collections")}
					>Collections</button
				>
			</div>
			<div class="sidebar-content">
				{#if activeTab === "users"}
					<UserList roomId={$currentRoomId} />
				{:else}
					<CollectionManager />
				{/if}
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.app-layout {
		display: grid;
		grid-template-columns: 1fr 300px;
		height: 100vh;
		background: #000;
		overflow: hidden;
		position: relative;

		@media (max-width: 768px) {
			display: flex;
			flex-direction: column;
			height: 100dvh;
			grid-template-columns: none;
		}
	}

	.mobile-header {
		display: none;

		@media (max-width: 768px) {
			display: flex;
			align-items: center;
			padding: 0.5rem 1rem;
			background: #181b21;
			border-bottom: 1px solid #2f3136;
			gap: 1rem;

			.hamburger {
				background: none;
				border: none;
				color: white;
				cursor: pointer;
				padding: 5px;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.mobile-brand {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				font-weight: bold;
				img {
					height: 20px;
				}
			}
		}
	}

	.player-area {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 1rem;
		overflow: hidden;
		background: #000;

		@media (max-width: 768px) {
			padding: 0;
			flex: 1; /* Take space but header is fixed at top */
			justify-content: flex-start;
			border-bottom: 1px solid #2f3136;
		}
	}

	.sidebar-overlay {
		display: none;
		@media (max-width: 768px) {
			display: block;
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.5);
			z-index: 100;
			backdrop-filter: blur(2px);
		}
	}

	.sidebar-area {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: #181b21;
		border-left: 1px solid #2f3136;
		min-width: 0;
		transition: transform 0.3s ease-in-out;

		@media (max-width: 768px) {
			position: fixed;
			top: 0;
			left: 0;
			width: 280px;
			height: 100dvh;
			z-index: 101;
			transform: translateX(-100%);
			border-left: none;
			border-right: 1px solid #2f3136;

			&.mobile-open {
				transform: translateX(0);
			}
		}
	}

	.sidebar-header-wrapper {
		display: flex;
		align-items: center;
		background: #1e222a;
		border-bottom: 1px solid #2f3136;

		.sidebar-header {
			flex: 1;
			display: flex;
			align-items: center;
			gap: 0.7rem;
			padding: 1rem;

			.mini-logo {
				height: 28px;
				width: auto;
			}

			.header-text {
				display: flex;
				flex-direction: column;
				.brand-name {
					font-weight: 800;
					font-size: 1rem;
					color: #fff;
					letter-spacing: -0.5px;
					line-height: 1.1;
				}
				.room-id-display {
					font-size: 0.75rem;
					color: #b9bbbe;
					font-family: monospace;
				}
			}
		}

		.leave-room-btn {
			display: flex;
			align-items: center;
			gap: 0.4rem;
			background: rgba(237, 66, 69, 0.1);
			color: #ed4245;
			border: 1px solid rgba(237, 66, 69, 0.2);
			padding: 0.4rem 0.8rem;
			margin-right: 0.5rem;
			border-radius: 4px;
			cursor: pointer;
			font-weight: 600;
			font-size: 0.85rem;
			transition: all 0.2s;

			&:hover {
				background: #ed4245;
				color: white;
				border-color: #ed4245;
			}

			@media (max-width: 768px) {
				span {
					display: none; /* Icon only on small mobile to save space */
				}
				padding: 0.5rem;
			}
		}

		.close-sidebar-btn {
			display: none;
			@media (max-width: 768px) {
				display: flex;
				background: none;
				border: none;
				color: #b9bbbe;
				padding: 1rem;
				cursor: pointer;
				&:hover {
					color: white;
				}
			}
		}
	}

	.sidebar-tabs {
		display: flex;
		border-bottom: 1px solid #2f3136;

		button {
			flex: 1;
			background: transparent;
			border: none;
			padding: 1rem;
			color: #b9bbbe;
			cursor: pointer;
			font-weight: bold;
			border-bottom: 2px solid transparent;

			&:hover {
				color: white;
				background: rgba(255, 255, 255, 0.05);
			}

			&.active {
				color: white;
				border-bottom-color: #5865f2;
			}
		}
	}

	.sidebar-content {
		flex: 1;
		overflow: hidden;
	}
</style>
