import Hls from "hls.js";
import { getProxyUrl, isHlsSource } from "./media";

// -------------------------------------------------------
// Interfaces
// -------------------------------------------------------

export interface IYoutubeComponent {
	play(): void;
	pause(): void;
	seekTo(seconds: number): void;
	setVolume(vol: number): void;
	mute(): void;
	unMute(): void;
	getCurrentTime(): number;
	getDuration(): number;
	getPlayerState(): number;
}

export type PlayerType = "youtube" | "html5";

// -------------------------------------------------------
// Base Player Class
// -------------------------------------------------------

export abstract class BasePlayer {
	abstract readonly type: PlayerType;
	protected _isPlaying: boolean = false;
	protected onPlayingChange?: (isPlaying: boolean) => void;

	// Flag to indicate if current action should not emit to server
	public isSilentAction: boolean = false;

	abstract play(silent?: boolean): Promise<void> | void;
	abstract pause(silent?: boolean): void;
	abstract seek(time: number): void;
	abstract setVolume(volume: number): void;
	abstract setMute(muted: boolean): void;
	abstract getCurrentTime(): number;
	abstract getDuration(): number;
	abstract destroy(): void;

	// Helper to check if player is ready
	abstract get isReady(): boolean;

	// Get current playing state
	get isPlaying(): boolean {
		return this._isPlaying;
	}

	// Set callback for playing state changes
	setPlayingChangeCallback(callback: (isPlaying: boolean) => void) {
		this.onPlayingChange = callback;
	}

	updatePlayingState(isPlaying: boolean) {
		if (this._isPlaying !== isPlaying) {
			this._isPlaying = isPlaying;
			this.onPlayingChange?.(isPlaying);
		}
	}
}

// -------------------------------------------------------
// YouTube Player Implementation
// -------------------------------------------------------

export class YouTubePlayer extends BasePlayer {
	readonly type: PlayerType = "youtube";

	constructor(private component: IYoutubeComponent) {
		super();
	}

	play(silent: boolean = false) {
		if (this.component) {
			this.isSilentAction = silent;
			this.component.play();
			this.updatePlayingState(true);
		}
	}

	pause(silent: boolean = false) {
		if (this.component) {
			this.isSilentAction = silent;
			this.component.pause();
			this.updatePlayingState(false);
		}
	}

	seek(time: number) {
		if (this.component) this.component.seekTo(time);
	}

	setVolume(volume: number) {
		if (this.component) {
			this.component.setVolume(volume);
			if (volume === 0) this.component.mute();
			else this.component.unMute();
		}
	}

	setMute(muted: boolean) {
		if (this.component) {
			if (muted) this.component.mute();
			else this.component.unMute();
		}
	}

	getCurrentTime() {
		return this.component ? this.component.getCurrentTime() : 0;
	}

	getDuration() {
		return this.component ? this.component.getDuration() : 0;
	}

	destroy() {
		// Lifecycle managed by Svelte component
	}

	get isReady() {
		return !!this.component;
	}
}

// -------------------------------------------------------
// HTML5 / HLS Player Implementation
// -------------------------------------------------------

export class HTML5Player extends BasePlayer {
	readonly type: PlayerType = "html5";
	private hls: Hls | null = null;

	constructor(
		private videoElement: HTMLVideoElement,
		private callbacks?: {
			onManifestParsed?: () => void;
			onError?: (errorType: string, details: string, fatal: boolean) => void;
		}
	) {
		super();
	}

	async load(url: string, referer: string = "", startTime: number = 0, autoPlay: boolean = false) {
		this.destroyInternal(); // Cleanup existing HLS

		const videoUrl = getProxyUrl(url, referer);

		// Reset basic properties
		this.videoElement.currentTime = startTime;

		if (Hls.isSupported() && isHlsSource(url)) {
			this.setupHls(videoUrl, startTime, autoPlay);
		} else {
			this.setupNative(videoUrl, startTime, autoPlay);
		}
	}

	private setupHls(videoUrl: string, startTime: number, autoPlay: boolean) {
		this.hls = new Hls({
			capLevelToPlayerSize: true,
			manifestLoadingMaxRetry: 2,
			levelLoadingMaxRetry: 2,
			fragLoadingMaxRetry: 3,
			enableWorker: true,
			xhrSetup: (xhr) => {
				xhr.withCredentials = false;
			},
		});

		this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
			if (Math.abs(this.videoElement.currentTime - startTime) > 0.5) {
				this.videoElement.currentTime = startTime;
			}
			if (autoPlay) this.play();
			this.callbacks?.onManifestParsed?.();
		});

		this.hls.on(Hls.Events.ERROR, (event, data) => {
			this.callbacks?.onError?.(data.type, data.details, data.fatal);

			if (data.fatal) {
				switch (data.type) {
					case Hls.ErrorTypes.MEDIA_ERROR:
						this.hls?.recoverMediaError();
						break;
					case Hls.ErrorTypes.NETWORK_ERROR:
						// Network errors are handled by the main component retry logic via onError callback
						break;
					default:
						this.hls?.destroy();
						break;
				}
			}
		});

		this.hls.loadSource(videoUrl);
		this.hls.attachMedia(this.videoElement);
	}

	private setupNative(videoUrl: string, startTime: number, autoPlay: boolean) {
		this.videoElement.src = videoUrl;

		const onCanPlay = () => {
			if (autoPlay) this.play();
			this.callbacks?.onManifestParsed?.();
			this.videoElement.removeEventListener("canplay", onCanPlay);
		};

		this.videoElement.addEventListener("canplay", onCanPlay);
		this.videoElement.load();
	}

	async play(silent: boolean = false) {
		this.isSilentAction = silent;
		try {
			await this.videoElement.play();
			this.updatePlayingState(true);
		} catch (e) {
			console.warn("[HTML5Player] Play interrupted or failed:", e);
			this.updatePlayingState(false);
		}
	}

	pause(silent: boolean = false) {
		this.isSilentAction = silent;
		this.videoElement.pause();
		this.updatePlayingState(false);
	}

	seek(time: number) {
		if (Number.isFinite(time)) {
			this.videoElement.currentTime = time;
		}
	}

	setVolume(volume: number) {
		this.videoElement.volume = Math.max(0, Math.min(1, volume));
	}

	setMute(muted: boolean) {
		this.videoElement.muted = muted;
	}

	getCurrentTime() {
		return this.videoElement.currentTime;
	}

	getDuration() {
		return this.videoElement.duration || 0;
	}

	private destroyInternal() {
		if (this.hls) {
			this.hls.destroy();
			this.hls = null;
		}
		this.videoElement.removeAttribute("src");
		this.videoElement.load();
	}

	destroy() {
		this.destroyInternal();
	}

	get isReady() {
		return !!this.videoElement;
	}
}
