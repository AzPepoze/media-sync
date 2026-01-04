import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ResolvedMedia {
    url: string;
    referer?: string;
}

export const resolveVideoUrl = async (url: string): Promise<ResolvedMedia> => {
    const lowerUrl = url.toLowerCase().split('?')[0];
    const videoExtensions = [".m3u8", ".mp4", ".webm", ".mkv", ".avi", ".mov", ".flv", ".txt"];
    
    if (videoExtensions.some(ext => lowerUrl.endsWith(ext))) {
        return { url };
    }

    // --- NORMAL WAY ---
    try {
        const cmd = `yt-dlp -g --no-check-certificates --no-warnings "${url}"`;
        const { stdout } = await execAsync(cmd);
        const resolvedUrl = stdout.trim().split('\n')[0];
        if (resolvedUrl && resolvedUrl.startsWith("http")) {
            return { url: resolvedUrl, referer: url };
        }
    } catch (normalError) {
        console.log(`Normal yt-dlp failed for ${url}, trying advanced way...`);
    }

    // --- Advanced Fallback ---
    try {
        const cmd = `yt-dlp --dump-single-json --impersonate "chrome" --extractor-args "generic:impersonate" --no-check-certificates --no-warnings "${url}"`;
        const { stdout } = await execAsync(cmd);
        const info = JSON.parse(stdout);

        if (info && info.url) {
            return {
                url: info.url,
                referer: info.http_headers?.Referer || info.webpage_url || undefined
            };
        }
        
        if (info && info.formats && info.formats.length > 0) {
            const bestFormat = info.formats.find((f: any) => f.vcodec !== 'none' && f.acodec !== 'none') || info.formats[info.formats.length - 1];
            return {
                url: bestFormat.url,
                referer: info.http_headers?.Referer || info.webpage_url || undefined
            };
        }
    } catch (advancedError) {
        console.log(`Advanced yt-dlp also failed for ${url}, returning original. Error: ${(advancedError as any).message}`);
    }

    return { url };
};