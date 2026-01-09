import { writable } from "svelte/store";

const STORAGE_KEY = "nativeYoutubeEnabled";

function readDefault(): boolean {
	try {
		const v = localStorage.getItem(STORAGE_KEY);
		if (v === null) return true; // default true
		return v === "true";
	} catch (e) {
		return true;
	}
}

export const nativeYouTubeEnabled = writable<boolean>(typeof localStorage !== "undefined" ? readDefault() : true);

// Persist changes
nativeYouTubeEnabled.subscribe((val) => {
	try {
		localStorage.setItem(STORAGE_KEY, val ? "true" : "false");
	} catch (e) {
		// ignore
	}
});

export default nativeYouTubeEnabled;
