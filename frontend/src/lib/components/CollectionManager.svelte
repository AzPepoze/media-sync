<script lang="ts">
	import { slide, fade, fly } from "svelte/transition";
	import { flip } from "svelte/animate";
	import {
		collections,
		addCollection,
		deleteCollection,
		addToCollection,
		removeFromCollection,
		renameCollection,
		updateCollectionItem,
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

	// Edit states
	let editingCollectionId: string | null = null;
	let editCollectionName = "";

	let editingItemId: string | null = null;
	let editItemTitle = "";
	let editItemUrl = "";
	let editItemReferer = "";

	function handleAddCollection() {
		if (newCollectionName.trim()) {
			addCollection(newCollectionName);
			newCollectionName = "";
		}
	}

	function startRenameCollection(id: string, currentName: string) {
		editingCollectionId = id;
		editCollectionName = currentName;
	}

	function saveRenameCollection(id: string) {
		if (editCollectionName.trim() !== "") {
			renameCollection(id, editCollectionName.trim());
		}
		editingCollectionId = null;
		editCollectionName = "";
	}

	function cancelRenameCollection() {
		editingCollectionId = null;
		editCollectionName = "";
	}

	function startEditItem(id: string, current: { title: string; url: string; referer?: string }) {
		editingItemId = id;
		editItemTitle = current.title;
		editItemUrl = current.url;
		editItemReferer = current.referer || "";
	}

	function saveEditItem(collectionId: string, itemId: string) {
		if (editItemTitle.trim() && editItemUrl.trim()) {
			updateCollectionItem(collectionId, itemId, {
				title: editItemTitle.trim(),
				url: editItemUrl.trim(),
				referer: editItemReferer.trim() || undefined,
			});
		}
		editingItemId = null;
		editItemTitle = "";
		editItemUrl = "";
		editItemReferer = "";
	}

	function cancelEditItem() {
		editingItemId = null;
		editItemTitle = "";
		editItemTitle = "";
		editItemUrl = "";
		editItemReferer = "";
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
			<div class="collection-item" animate:flip={{ duration: 300 }} in:slide out:fade>
				<div class="collection-header">
					{#if editingCollectionId === collection.id}
						<div class="edit-collection-form" in:fade>
							<input
								type="text"
								bind:value={editCollectionName}
								placeholder="Collection Name"
								on:keydown={(e) => {
									if (e.key === "Enter") saveRenameCollection(collection.id);
									if (e.key === "Escape") cancelRenameCollection();
								}}
							/>
							<div class="edit-controls">
								<button
									class="sm-btn highlight"
									on:click={() => saveRenameCollection(collection.id)}>Save</button
								>
								<button class="sm-btn secondary" on:click={cancelRenameCollection}
									>Cancel</button
								>
							</div>
						</div>
					{:else}
						<div class="header-content" in:fade>
							<span
								class="name"
								on:dblclick={() => startRenameCollection(collection.id, collection.name)}
								title="Double click to rename"
								role="button"
								tabindex="0">{collection.name}</span
							>
							<div class="controls">
								<button
									class="sm-btn primary-action"
									on:click={() => startRenameCollection(collection.id, collection.name)}
									title="Rename"
								>
									✎ Rename
								</button>
								<button
									class="sm-btn"
									on:click={() => handleExportCollection(collection.id, collection.name)}
									title="Export this collection"
								>
									Export
								</button>
								<button
									class="sm-btn highlight"
									on:click={() =>
										(activeCollectionId =
											activeCollectionId === collection.id ? null : collection.id)}
								>
									{activeCollectionId === collection.id ? "Done" : "+ Add Video"}
								</button>
								<button class="sm-btn danger" on:click={() => deleteCollection(collection.id)}
									>Delete</button
								>
							</div>
						</div>
					{/if}
				</div>

				{#if activeCollectionId === collection.id}
					<div class="add-item-form" transition:slide>
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
						<div animate:flip={{ duration: 300 }}>
							{#if editingItemId === item.id}
								<div class="edit-item-form" transition:slide>
									<input type="text" bind:value={editItemTitle} placeholder="Title" />
									<input type="text" bind:value={editItemUrl} placeholder="URL" />
									<input type="text" bind:value={editItemReferer} placeholder="Referer" />
									<div class="edit-controls">
										<button
											class="sm-btn highlight"
											on:click={() => saveEditItem(collection.id, item.id)}>Save</button
										>
										<button class="sm-btn secondary" on:click={cancelEditItem}>Cancel</button>
									</div>
								</div>
							{:else}
								<div
									class="media-item"
									in:fly={{ x: 20, duration: 300 }}
									out:fade
								>
									<button class="play-btn" on:click={() => playItem(item)} title="Play Video">
										▶
									</button>
									<div class="info">
										<span class="title">{item.title}</span>
										<span class="url">{item.url}</span>
									</div>
									<div class="item-controls">
										<button
											class="sm-btn"
											on:click={() => startEditItem(item.id, item)}
											title="Edit"
										>
											Edit
										</button>
										<button
											class="sm-btn danger"
											on:click={() => removeFromCollection(collection.id, item.id)}
											>Delete</button
										>
									</div>
								</div>
							{/if}
						</div>
					{/each}
					{#if collection.items.length === 0}
						<div class="empty-msg" transition:fade>No videos</div>
					{/if}
				</div>
			</div>
		{/each}
		{#if $collections.length === 0}
			<div class="empty-msg center" transition:fade>No collections created</div>
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
				font-size: 0.85rem;
				padding: 6px 12px;
				min-width: 60px;
				background: #3a3e44;
				transition: all 0.2s;

				&:hover {
					background: #4f545c;
				}

				&.danger {
					background: rgba($danger, 0.8);
					&:hover {
						background: $danger;
					}
				}

				&.primary-action {
					background: rgba($primary, 0.2);
					border: 1px solid rgba($primary, 0.4);
					&:hover {
						background: rgba($primary, 0.3);
						border-color: $primary;
					}
				}

				&.highlight {
					background: $primary;
					font-weight: 600;
					&:hover {
						background: lighten($primary, 5%);
					}
				}
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
				font-weight: bold;

				.header-content {
					display: flex;
					flex-direction: column;
					gap: 8px;
				}

				.name {
					cursor: pointer;
					font-size: 1rem;
					&:hover {
						text-decoration: underline;
					}
				}

				.controls {
					display: flex;
					gap: 5px;
					flex-wrap: wrap;
				}

				.edit-collection-form {
					display: flex;
					flex-direction: column;
					gap: 5px;

					.edit-controls {
						display: flex;
						gap: 5px;
					}
				}
			}
		}

		.add-item-form,
		.edit-item-form {
			padding: 0.5rem;
			background: #292b2f;
			display: flex;
			flex-direction: column;
			gap: 5px;

			.form-actions,
			.edit-controls {
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
			align-items: center;
			background: #2f3136;
			padding: 8px;
			border-radius: 4px;
			font-size: 0.9rem;
			gap: 10px;

			.play-btn {
				background: $primary;
				color: white;
				border: none;
				border-radius: 50%;
				width: 32px;
				height: 32px;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				flex-shrink: 0;
				font-size: 0.8rem;
				transition: transform 0.2s;

				&:hover {
					transform: scale(1.1);
					filter: brightness(1.1);
				}
			}

			.info {
				display: flex;
				flex-direction: column;
				flex: 1;
				min-width: 0; // Allows ellipsis to work in flex
				gap: 2px;

				.title {
					font-weight: 500;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.url {
					font-size: 0.75rem;
					color: $text-muted;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
					opacity: 0.8;
				}
			}

			.item-controls {
				display: flex;
				gap: 5px;
				flex-shrink: 0;
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
