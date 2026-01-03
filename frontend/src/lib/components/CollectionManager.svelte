<script lang="ts">
	import {
		collections,
		addCollection,
		deleteCollection,
		addToCollection,
		removeFromCollection,
		renameCollection,
		renameCollectionItem,
		exportCollectionsJson,
		importCollectionsJson,
		exportCollectionJson,
	} from "$lib/stores/collection";
	import { currentRoomId, setUrl, roomState } from "$lib/stores/socket";

	let newCollectionName = "";
	let newItemUrl = "";
	let newItemTitle = "";
	let newItemReferer = "";

	// UI State for toggling inputs
	let activeCollectionId: string | null = null;
	let fileInput: HTMLInputElement;

	function handleAddCollection() {
		if (newCollectionName.trim()) {
			addCollection(newCollectionName);
			newCollectionName = "";
		}
	}

	function handleRenameCollection(id: string, currentName: string) {
		const newName = prompt("Enter new collection name:", currentName);
		if (newName && newName.trim() !== "") {
			renameCollection(id, newName.trim());
		}
	}

	function handleRenameItem(collectionId: string, itemId: string, currentTitle: string) {
		const newTitle = prompt("Enter new video title:", currentTitle);
		if (newTitle && newTitle.trim() !== "") {
			renameCollectionItem(collectionId, itemId, newTitle.trim());
		}
	}

	function handleAddItem(collectionId: string) {
		if (newItemUrl.trim() && newItemTitle.trim()) {
			addToCollection(collectionId, {
				title: newItemTitle,
				url: newItemUrl,
				referer: newItemReferer || undefined,
			});
			newItemUrl = "";
			newItemTitle = "";
			newItemReferer = "";
		}
	}

	function handleAddCurrentVideo(collectionId: string) {
		if ($roomState && $roomState.videoUrl) {
			const url = $roomState.videoUrl;
			// Try to guess a title from URL if possible, or just use URL/timestamp
			const title = `Saved Video ${new Date().toLocaleTimeString()}`;
			addToCollection(collectionId, {
				title: title,
				url: url,
				referer: $roomState.referer || undefined,
			});
		}
	}

	function playItem(item: { url: string; referer?: string }) {
		if ($currentRoomId) {
			setUrl($currentRoomId, item.url, item.referer || "");
		}
	}

	function handleExport() {
		const json = exportCollectionsJson();
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "media-sync-collections.json";
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleExportCollection(collectionId: string, name: string) {
		const json = exportCollectionJson(collectionId);
		if (json) {
			const blob = new Blob([json], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.json`;
			a.click();
			URL.revokeObjectURL(url);
		}
	}

	function triggerImport() {
		fileInput.click();
	}

	function handleImport(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			const reader = new FileReader();
			reader.onload = (e) => {
				if (e.target?.result) {
					importCollectionsJson(e.target.result as string);
				}
			};
			reader.readAsText(target.files[0]);
		}
		// Reset value so same file can be selected again
		target.value = "";
	}
</script>

<div class="collection-manager">
	<div class="header">
		<h3>Collections</h3>
		<div class="actions">
			<button class="icon-btn" on:click={handleExport} title="Export JSON">💾</button>
			<button class="icon-btn" on:click={triggerImport} title="Import JSON">📂</button>
			<input
				type="file"
				bind:this={fileInput}
				on:change={handleImport}
				style="display: none;"
				accept=".json"
			/>
		</div>
	</div>

	<div class="add-collection-row">
		<input
			type="text"
			bind:value={newCollectionName}
			placeholder="New Collection Name"
			on:keydown={(e) => e.key === "Enter" && handleAddCollection()}
		/>
		<button on:click={handleAddCollection}>+</button>
	</div>

	<div class="collections-list">
		{#each $collections as collection (collection.id)}
			<div class="collection-item">
				<div class="collection-header">
					<span
						class="name"
						on:dblclick={() => handleRenameCollection(collection.id, collection.name)}
						title="Double click to rename"
						role="button"
						tabindex="0">{collection.name}</span
					>
					<div class="controls">
						<button
							class="sm-btn"
							on:click={() => handleRenameCollection(collection.id, collection.name)}
							title="Rename"
						>
							✎
						</button>
						<button
							class="sm-btn"
							on:click={() => handleExportCollection(collection.id, collection.name)}
							title="Export this collection"
						>
							Export
						</button>
						<button
							class="sm-btn"
							on:click={() =>
								(activeCollectionId =
									activeCollectionId === collection.id ? null : collection.id)}
						>
							{activeCollectionId === collection.id ? "Done" : "+ Video"}
						</button>
						<button class="sm-btn danger" on:click={() => deleteCollection(collection.id)}
							>Delete</button
						>
					</div>
				</div>

				{#if activeCollectionId === collection.id}
					<div class="add-item-form">
						<input type="text" bind:value={newItemTitle} placeholder="Title" />
						<input type="text" bind:value={newItemUrl} placeholder="URL" />
						<input type="text" bind:value={newItemReferer} placeholder="Referer (Optional)" />
						<div class="form-actions">
							<button on:click={() => handleAddItem(collection.id)}>Add</button>
							<button class="secondary" on:click={() => handleAddCurrentVideo(collection.id)}
								>Add Current</button
							>
						</div>
					</div>
				{/if}

				<div class="items-list">
					{#each collection.items as item (item.id)}
						<div class="media-item">
							<div
								class="info"
								on:click={() => playItem(item)}
								role="button"
								tabindex="0"
								on:keypress={(e) => e.key === "Enter" && playItem(item)}
							>
								<span class="title">▶ {item.title}</span>
							</div>
							<div class="item-controls">
								<button
									class="xs-btn"
									on:click={() => handleRenameItem(collection.id, item.id, item.title)}
									title="Rename"
								>
									✎
								</button>
								<button
									class="xs-btn danger"
									on:click={() => removeFromCollection(collection.id, item.id)}>x</button
								>
							</div>
						</div>
					{/each}
					{#if collection.items.length === 0}
						<div class="empty-msg">No videos</div>
					{/if}
				</div>
			</div>
		{/each}
		{#if $collections.length === 0}
			<div class="empty-msg center">No collections created</div>
		{/if}
	</div>
</div>

<style lang="scss">
	$bg-dark: #0f1115;
	$bg-panel: #181b21;
	$primary: #5865f2;
	$danger: #ed4245;
	$text-main: #ffffff;
	$text-muted: #b9bbbe;
	$border: #2f3136;

	.collection-manager {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: $bg-panel;
		color: $text-main;
		overflow: hidden;

		.header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 1rem;
			border-bottom: 1px solid $border;

			h3 {
				margin: 0;
				font-size: 1.1rem;
			}

			.actions {
				display: flex;
				gap: 5px;
			}
		}

		button {
			cursor: pointer;
			border: none;
			border-radius: 4px;
			background: $primary;
			color: white;
			padding: 4px 8px;

			&:hover {
				filter: brightness(1.1);
			}
			&.danger {
				background: $danger;
			}
			&.secondary {
				background: #4f545c;
			}

			&.icon-btn {
				background: transparent;
				font-size: 1.2rem;
				padding: 2px;
				&:hover {
					background: rgba(255, 255, 255, 0.1);
				}
			}
			&.sm-btn {
				font-size: 0.8rem;
				padding: 2px 6px;
			}
			&.xs-btn {
				font-size: 0.7rem;
				padding: 0 4px;
				line-height: 1.2;
			}
		}

		input[type="text"] {
			background: $bg-dark;
			border: 1px solid $border;
			color: white;
			padding: 6px;
			border-radius: 4px;
			width: 100%;
			box-sizing: border-box;

			&:focus {
				outline: none;
				border-color: $primary;
			}
		}

		.add-collection-row {
			padding: 0.5rem;
			display: flex;
			gap: 5px;
			border-bottom: 1px solid $border;
		}

		.collections-list {
			flex: 1;
			overflow-y: auto;
			padding: 0.5rem;
		}

		.collection-item {
			margin-bottom: 1rem;
			border: 1px solid $border;
			border-radius: 6px;
			overflow: hidden;

			.collection-header {
				background: #202225;
				padding: 0.5rem;
				display: flex;
				justify-content: space-between;
				align-items: center;
				font-weight: bold;

				.name {
					cursor: pointer;
					&:hover {
						text-decoration: underline;
					}
				}

				.controls {
					display: flex;
					gap: 5px;
				}
			}
		}

		.add-item-form {
			padding: 0.5rem;
			background: #292b2f;
			display: flex;
			flex-direction: column;
			gap: 5px;

			.form-actions {
				display: flex;
				gap: 5px;
				margin-top: 5px;
			}
		}

		.items-list {
			display: flex;
			flex-direction: column;
			gap: 2px;
			padding: 0.5rem;
		}

		.media-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			background: #2f3136;
			padding: 4px 8px;
			border-radius: 4px;
			font-size: 0.9rem;

			.info {
				cursor: pointer;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				flex: 1;
				margin-right: 5px;
				&:hover {
					color: $primary;
				}
			}

			.item-controls {
				display: flex;
				gap: 2px;
			}
		}

		.empty-msg {
			color: $text-muted;
			font-size: 0.8rem;
			font-style: italic;
			padding: 0.2rem;

			&.center {
				text-align: center;
				padding: 1rem;
			}
		}
	}
</style>
