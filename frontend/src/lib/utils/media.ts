import { SERVER_URL } from "../stores/socket";

export function checkIsMobile(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function getProxyUrl(url: string, referer: string = ""): string {
    const isMobile = checkIsMobile();
    const lowerUrl = url.toLowerCase();

    if (isMobile) {
        let videoUrl = `${SERVER_URL}/proxy?url=${encodeURIComponent(url)}&proxySegments=true`;
        if (referer) videoUrl += `&referer=${encodeURIComponent(referer)}`;
        return videoUrl;
    }

    if (lowerUrl.includes(".m3u8") || lowerUrl.includes(".txt") || lowerUrl.includes(".mpd")) {
        let videoUrl = `${SERVER_URL}/proxy?url=${encodeURIComponent(url)}`; 
        if (referer) videoUrl += `&referer=${encodeURIComponent(referer)}`;
        return videoUrl;
    }

    return url;
}

export function isHlsSource(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes(".m3u8") || lowerUrl.includes(".txt");
}

export function getYoutubeId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
}
