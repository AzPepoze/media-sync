import { writable } from "svelte/store";

const STORAGE_KEY = "media_sync_settings";

interface Settings {
	nativeYouTubeEnabled: boolean;
	useProxy: boolean;
}

function readDefault(): Settings {
	const defaultSettings: Settings = {
		nativeYouTubeEnabled: true,
		useProxy: false,
	};

	if (typeof localStorage === "undefined") return defaultSettings;

	try {
		const v = localStorage.getItem(STORAGE_KEY);
		if (v === null) {
			// Migration for old key
			const oldNative = localStorage.getItem("nativeYoutubeEnabled");
			if (oldNative !== null) {
				defaultSettings.nativeYouTubeEnabled = oldNative === "true";
			}
			return defaultSettings;
		}
		return { ...defaultSettings, ...JSON.parse(v) };
	} catch (e) {
		return defaultSettings;
	}
}

export const settings = writable<Settings>(readDefault());

// Persist changes
if (typeof localStorage !== "undefined") {
	settings.subscribe((val) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
		} catch (e) {
			// ignore
		}
	});
}

export default settings;
