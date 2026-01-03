import { writable, get } from "svelte/store";
import { browser } from "$app/environment";
import type { Collection, PlaylistItem } from "$lib/types";

const STORAGE_KEY = "media-sync-collections";

// Initial state
const initialCollections: Collection[] = [];

// Create store
export const collections = writable<Collection[]>(initialCollections);

// Load from local storage on init (client-side only)
if (browser) {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		try {
			const parsed = JSON.parse(stored);
			// Simple check to see if we need to migrate (if it has playlists but no items)
			// This is a naive migration or just a safety check
			const migrated = parsed.map((c: any) => {
				if (c.playlists && !c.items) {
					// Flatten playlists into items if needed, or just start empty to avoid crash
					// Let's flatten for better UX if possible
					const flattenedItems: any[] = [];
					if (Array.isArray(c.playlists)) {
						c.playlists.forEach((p: any) => {
							if (Array.isArray(p.items)) {
								flattenedItems.push(...p.items);
							}
						});
					}
					return { ...c, items: flattenedItems, playlists: undefined };
				}
				return c;
			});
			collections.set(migrated);
		} catch (e) {
			console.error("Failed to load collections from local storage", e);
		}
	}

	// Auto-save to local storage whenever collections change
	collections.subscribe((value) => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
	});
}

// Helper to generate IDs
function generateId(): string {
	return Math.random().toString(36).substr(2, 9);
}

// Actions
export function addCollection(name: string) {
	collections.update((cols) => [
		...cols,
		{
			id: generateId(),
			name,
			items: [],
		},
	]);
}

export function deleteCollection(collectionId: string) {
	collections.update((cols) => cols.filter((c) => c.id !== collectionId));
}

export function renameCollection(collectionId: string, newName: string) {
	collections.update((cols) =>
		cols.map((c) => {
			if (c.id === collectionId) {
				return { ...c, name: newName };
			}
			return c;
		})
	);
}

export function addToCollection(collectionId: string, item: Omit<PlaylistItem, "id">) {
	collections.update((cols) =>
		cols.map((c) => {
			if (c.id === collectionId) {
				return {
					...c,
					items: [
						...c.items,
						{
							...item,
							id: generateId(),
						},
					],
				};
			}
			return c;
		})
	);
}

export function removeFromCollection(collectionId: string, itemId: string) {
	collections.update((cols) =>
		cols.map((c) => {
			if (c.id === collectionId) {
				return {
					...c,
					items: c.items.filter((i) => i.id !== itemId),
				};
			}
			return c;
		})
	);
}

export function renameCollectionItem(collectionId: string, itemId: string, newTitle: string) {
	collections.update((cols) =>
		cols.map((c) => {
			if (c.id === collectionId) {
				return {
					...c,
					items: c.items.map((i) => {
						if (i.id === itemId) {
							return { ...i, title: newTitle };
						}
						return i;
					}),
				};
			}
			return c;
		})
	);
}

export function updateCollectionItem(
	collectionId: string,
	itemId: string,
	updates: Partial<Omit<PlaylistItem, "id">>
) {
	collections.update((cols) =>
		cols.map((c) => {
			if (c.id === collectionId) {
				return {
					...c,
					items: c.items.map((i) => {
						if (i.id === itemId) {
							return { ...i, ...updates };
						}
						return i;
					}),
				};
			}
			return c;
		})
	);
}

export function exportCollectionsJson(): string {
	return JSON.stringify(get(collections), null, 2);
}

export function exportCollectionJson(collectionId: string): string | null {
	const all = get(collections);
	const col = all.find((c) => c.id === collectionId);
	if (col) {
		return JSON.stringify(col, null, 2);
	}
	return null;
}

export function importCollectionsJson(json: string) {
	try {
		const parsed = JSON.parse(json);
		// Basic validation could be added here
		if (Array.isArray(parsed)) {
			collections.set(parsed);
		} else {
			throw new Error("Invalid format: Root must be an array");
		}
	} catch (e) {
		console.error("Failed to import collections", e);
		alert("Failed to import: Invalid JSON format");
	}
}
