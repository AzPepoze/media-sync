<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { isJoined, initSocket, cleanupSocket, currentRoomId } from "$lib/stores/socket";
	import WelcomeScreen from "$lib/components/WelcomeScreen.svelte";
	import VideoPlayer from "$lib/components/VideoPlayer.svelte";
	import UserList from "$lib/components/UserList.svelte";
	import UrlBar from "$lib/components/UrlBar.svelte";
	import CollectionManager from "$lib/components/CollectionManager.svelte";

	let activeTab: "users" | "collections" = "users";

	onMount(() => {
		initSocket();
	});

	onDestroy(() => {
		cleanupSocket();
	});

	function goHome() {
		isJoined.set(false);
		window.history.pushState({}, '', '/');
	}
</script>

{#if !$isJoined}
	<WelcomeScreen />
{:else}
	<div class="app-layout">
		<div class="player-area">
			<VideoPlayer />
			<UrlBar />
		</div>
		<div class="sidebar-area">
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="sidebar-header" on:click={goHome} title="Return to Welcome Page">
				<img src="/logo.png" alt="Media Sync" class="mini-logo" />
				<span class="brand-name">Media Sync</span>
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

		@media (max-width: 768px) {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr auto;
			overflow-y: auto;
		}
	}

	.player-area {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 1rem;
		overflow: hidden;
	}

	.sidebar-area {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: #181b21;
		border-left: 1px solid #2f3136;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		border-bottom: 1px solid #2f3136;
		background: #1e222a;
		cursor: pointer;
		transition: background 0.2s;

		&:hover {
			background: #292b2f;
		}

		.mini-logo {
			height: 24px;
			width: auto;
		}

		.brand-name {
			font-weight: 800;
			font-size: 1.1rem;
			color: #fff;
			letter-spacing: -0.5px;
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
		overflow-y: auto;
	}
</style>
