import Hls from "hls.js";
import { getProxyUrl, isHlsSource } from "./media";

// Interface for the YouTube Component (public methods)
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

export abstract class BasePlayer {
    abstract play(): Promise<void> | void;
    abstract pause(): void;
    abstract seek(time: number): void;
    abstract setVolume(volume: number): void;
    abstract setMute(muted: boolean): void;
    abstract getCurrentTime(): number;
    abstract getDuration(): number;
    abstract destroy(): void;
    abstract get isReady(): boolean;
    abstract type: 'youtube' | 'html5';
}

export class YouTubePlayer extends BasePlayer {
    readonly type = 'youtube';
    constructor(private component: IYoutubeComponent) {
        super();
    }

    play() {
        if (this.component) this.component.play();
    }

    pause() {
        if (this.component) this.component.pause();
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
        // Component lifecycle is managed by Svelte
    }

    get isReady() {
        return !!this.component;
    }
}

export class HTML5Player extends BasePlayer {
    readonly type = 'html5';
    private hls: Hls | null = null;

    constructor(
        private videoElement: HTMLVideoElement,
        private onManifestParsed?: () => void,
        private onError?: (errorType: string, details: string, fatal: boolean) => void
    ) {
        super();
    }

    async load(url: string, referer: string = "", startTime: number = 0, autoPlay: boolean = false) {
        this.destroy(); // Clear previous HLS if any

        const videoUrl = getProxyUrl(url, referer);

        if (Hls.isSupported() && isHlsSource(url)) {
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
                this.videoElement.currentTime = startTime;
                if (autoPlay) this.play();
                if (this.onManifestParsed) this.onManifestParsed();
            });

            this.hls.on(Hls.Events.ERROR, (event, data) => {
                if (this.onError) {
                    this.onError(data.type, data.details, data.fatal);
                }
                
                // Basic HLS error recovery logic
                if (data.fatal) {
                   if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        this.hls?.recoverMediaError();
                    } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        // Network error handling usually requires upper-level retry logic
                        // We leave that to the callback
                    } else {
                        this.hls?.destroy();
                    }
                }
            });

            this.hls.loadSource(videoUrl);
            this.hls.attachMedia(this.videoElement);
        } else {
            this.videoElement.src = videoUrl;
            this.videoElement.currentTime = startTime;
            // Native HLS or MP4
            const onCanPlay = () => {
                 if (autoPlay) this.play();
                 if (this.onManifestParsed) this.onManifestParsed();
                 this.videoElement.removeEventListener('canplay', onCanPlay);
            };
            this.videoElement.addEventListener('canplay', onCanPlay);
            this.videoElement.load();
        }
    }

    async play() {
        try {
            await this.videoElement.play();
        } catch (e) {
            console.error("Play failed", e);
        }
    }

    pause() {
        this.videoElement.pause();
    }

    seek(time: number) {
        this.videoElement.currentTime = time;
    }

    setVolume(volume: number) {
        this.videoElement.volume = volume;
    }

    setMute(muted: boolean) {
        this.videoElement.muted = muted;
    }

    getCurrentTime() {
        return this.videoElement.currentTime;
    }

    getDuration() {
        return this.videoElement.duration;
    }

    destroy() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        // We don't destroy videoElement as it's a prop
        this.videoElement.removeAttribute("src");
        this.videoElement.load();
    }
    
    get isReady() {
        return !!this.videoElement;
    }
}
