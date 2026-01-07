import { exec } from "child_process";
import { promisify } from "util";
import { chromium } from "playwright";

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
	const normalResult = await ytdlp(url);
	if (normalResult) {
		console.log("[YTDLP] Normal Strategy succeeded.");
		return normalResult;
	}

	console.log("[YTDLP] Normal Strategy failed. Trying Advanced Strategy...");
	const advancedResult = await ytdlp2(url);
	if (advancedResult) {
		console.log("[YTDLP] Advanced Strategy succeeded.");
		return advancedResult;
	}

	console.log("[YTDLP] Advanced Strategy failed. Trying Sniff Strategy...");
	const sniffResult = await sniffVideoUrl(url);
	if (sniffResult) {
		console.log("[YTDLP] Sniff Strategy succeeded.");
		return sniffResult;
	}

	console.error("[YTDLP] All strategies failed to resolve URL.");
	throw new Error("Unable to resolve video URL");
};

async function ytdlp(url: string): Promise<ResolvedMedia | null> {
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

async function ytdlp2(url: string): Promise<ResolvedMedia | null> {
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

async function sniffVideoUrl(url: string): Promise<ResolvedMedia | null> {
	let browser;
	try {
		browser = await chromium.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
		});
		const context = await browser.newContext({
			userAgent:
				"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		});
		const page = await context.newPage();

		let foundUrl: string | null = null;

		await page.route("**/*", (route) => {
			const type = route.request().resourceType();
			if (["stylesheet", "font"].includes(type)) {
				route.abort();
			} else {
				route.continue();
			}
		});

		page.on("request", (request) => {
			const reqUrl = request.url();
			const urlLower = reqUrl.toLowerCase();
			if (!foundUrl) {
				if (
					urlLower.includes(".m3u8") ||
					urlLower.includes(".mpd") ||
					urlLower.includes("/playlist") ||
					(urlLower.includes(".txt") && urlLower.includes("maimeorder.com"))
				) {
					foundUrl = reqUrl;
				}
			}
		});

		console.log(`[Sniff] Sniffing (Deeper): ${url}`);
		try {
			await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

			console.log("[Sniff] Attempting to trigger player by clicking...");
			await page.mouse.click(400, 300);

			const startTime = Date.now();
			while (!foundUrl && Date.now() - startTime < 15000) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		} catch (e: any) {
			console.warn(`[Sniff] Navigation/Click Warning: ${e.message}`);
		}

		if (foundUrl) {
			console.log(`[Sniff] Found Video Source: ${foundUrl}`);
			return { url: foundUrl, referer: url };
		}
	} catch (e: any) {
		console.error(`[Sniff] Strategy Error: ${e.message}`);
	} finally {
		if (browser) {
			await browser.close();
		}
	}
	return null;
}
