import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ResolvedMedia {
    url: string;
    referer?: string;
}

const COMMON_VIDEO_EXTENSIONS = [".m3u8", ".mp4", ".webm", ".mkv", ".avi", ".mov", ".flv", ".txt"];

export const resolveVideoUrl = async (url: string): Promise<ResolvedMedia> => {
    const lowerUrl = url.toLowerCase().split("?")[0];
    
    if (COMMON_VIDEO_EXTENSIONS.some(ext => lowerUrl.endsWith(ext))) {
        return { url };
    }

    const normalResult = await tryNormalStrategy(url);
    if (normalResult) return normalResult;

    const advancedResult = await tryAdvancedStrategy(url);
    if (advancedResult) return advancedResult;

    return { url };
};

async function tryNormalStrategy(url: string): Promise<ResolvedMedia | null> {
    try {
        const { stdout } = await execAsync(`yt-dlp -g --no-check-certificates --no-warnings "${url}"`);
        const resolvedUrl = stdout.trim().split("\n")[0];
        if (resolvedUrl && resolvedUrl.startsWith("http")) {
            return { url: resolvedUrl }; // No more forced referer here
        }
    } catch (e) {
        return null;
    }
    return null;
}

async function tryAdvancedStrategy(url: string): Promise<ResolvedMedia | null> {
    try {
        const cmd = `yt-dlp --dump-single-json --impersonate "chrome" --extractor-args "generic:impersonate" --no-check-certificates --no-warnings "${url}"`;
        const { stdout } = await execAsync(cmd);
        const info = JSON.parse(stdout);

        if (info && info.url) {
            return { 
                url: info.url, 
                referer: (info.http_headers?.Referer && info.http_headers.Referer !== url) ? info.http_headers.Referer : undefined 
            };
        }
        
        if (info && info.formats?.length > 0) {
            const best = info.formats.find((f: any) => f.vcodec !== "none" && f.acodec !== "none") || info.formats[info.formats.length - 1];
            return { 
                url: best.url, 
                referer: (info.http_headers?.Referer && info.http_headers.Referer !== url) ? info.http_headers.Referer : undefined 
            };
        }
    } catch (e) {}
    return null;
}
