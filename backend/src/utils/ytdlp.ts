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

	if (COMMON_VIDEO_EXTENSIONS.some((ext) => lowerUrl.endsWith(ext))) {
		console.log(`[YTDLP] Detected direct video link: ${url}`);
		return { url };
	}

	console.log(`[YTDLP] Attempting to resolve URL: ${url}`);
	console.log("[YTDLP] Trying Normal Strategy...");
	const normalResult = await tryNormalStrategy(url);
	if (normalResult) {
		console.log("[YTDLP] Normal Strategy succeeded.");
		return normalResult;
	}

	console.log("[YTDLP] Normal Strategy failed. Trying Advanced Strategy...");
	const advancedResult = await tryAdvancedStrategy(url);
	if (advancedResult) {
		console.log("[YTDLP] Advanced Strategy succeeded.");
		return advancedResult;
	}

	console.error("[YTDLP] All strategies failed to resolve URL.");
	throw new Error("Unable to resolve video URL");
};

async function tryNormalStrategy(url: string): Promise<ResolvedMedia | null> {
	try {
		const { stdout } = await execAsync(`yt-dlp -g --no-check-certificates --no-warnings "${url}"`);
		console.log(`[YTDLP] Normal Strategy Output: ${stdout}`);
		const resolvedUrl = stdout.trim().split("\n")[0];
		if (resolvedUrl && resolvedUrl.startsWith("http")) {
			return { url: resolvedUrl };
		}
	} catch (e: any) {
		console.warn(`[YTDLP] Normal Strategy Error: ${e.message}`);
		return null;
	}
	return null;
}

async function tryAdvancedStrategy(url: string): Promise<ResolvedMedia | null> {
	try {
		const cmd = `yt-dlp --dump-single-json --impersonate "chrome" --extractor-args "generic:impersonate" --no-check-certificates --no-warnings "${url}"`;
		const { stdout } = await execAsync(cmd);

		console.log(`[YTDLP] Advanced Strategy Output: ${stdout}`);

		const info = JSON.parse(stdout);

		if (info && info.url) {
			return {
				url: info.url,
				referer: info.http_headers?.Referer || undefined,
			};
		}

		if (info && info.formats?.length > 0) {
			const best =
				info.formats.find((f: any) => f.vcodec !== "none" && f.acodec !== "none") ||
				info.formats[info.formats.length - 1];
			return {
				url: best.url,
				referer: info.http_headers?.Referer || undefined,
			};
		}
	} catch (e: any) {
		console.error(`[YTDLP] Advanced Strategy Error: ${e.message}`);
	}
	return null;
}
