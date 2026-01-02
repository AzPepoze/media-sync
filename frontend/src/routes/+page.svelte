<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { isJoined, initSocket, cleanupSocket, currentRoomId } from "$lib/stores/socket";
	import LoginScreen from "$lib/components/LoginScreen.svelte";
	import VideoPlayer from "$lib/components/VideoPlayer.svelte";
	import UserList from "$lib/components/UserList.svelte";
	import UrlBar from "$lib/components/UrlBar.svelte";

	onMount(() => {
		initSocket();
	});

	onDestroy(() => {
		cleanupSocket();
	});
</script>

{#if !$isJoined}
	<LoginScreen />
{:else}
	<div class="app-layout">
		<div class="player-area">
			<VideoPlayer />
			<UrlBar />
		</div>
		<div class="sidebar-area">
			<UserList roomId={$currentRoomId} />
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
	}
</style>
