import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const resolveVideoUrl = async (url: string): Promise<string> => {
    // Skip yt-dlp if it's already a direct link we handle
    const lowerUrl = url.toLowerCase().split('?')[0];
    const videoExtensions = [".m3u8", ".mp4", ".webm", ".mkv", ".avi", ".mov", ".flv", ".txt"];
    
    if (videoExtensions.some(ext => lowerUrl.endsWith(ext))) {
        return url;
    }

    try {
        // -g: get url
        // -f b: best quality (or best combined)
        // --get-url: explicit get url
        const { stdout } = await execAsync(`yt-dlp -g -f "best[ext=mp4]/best" "${url}"`);
        const resolvedUrl = stdout.trim().split('\n')[0]; // Take the first line if multiple (video+audio separate sometimes)
        if (resolvedUrl && resolvedUrl.startsWith("http")) {
            return resolvedUrl;
        }
        return url;
    } catch (error) {
        console.log(`yt-dlp failed for ${url}, using original URL. Error: ${(error as any).message}`);
        return url;
    }
};
