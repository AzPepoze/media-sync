import { Router, Request, Response } from "express";
import axios, { AxiosRequestConfig } from "axios";
import { URL } from "url";

const router = Router();

// Constants & Types

const DEFAULT_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface ProxyRequestQuery {
	url?: string;
	referer?: string;
}

// Helper Functions

const createProxiedUrl = (targetUrl: string, serverBaseUrl: string, referer?: string): string => {
	try {
		const encodedUrl = encodeURIComponent(targetUrl);
		let proxyUrl = `${serverBaseUrl}/proxy?url=${encodedUrl}`;
		if (referer) proxyUrl += `&referer=${encodeURIComponent(referer)}`;
		return proxyUrl;
	} catch (error) {
		return targetUrl;
	}
};

const resolveAbsoluteUrl = (relativeOrAbsoluteUrl: string, baseUrl: string): string => {
	try {
		return new URL(relativeOrAbsoluteUrl.trim(), baseUrl).toString();
	} catch (error) {
		return relativeOrAbsoluteUrl;
	}
};

const rewriteManifestContent = (
	manifestContent: string,
	manifestBaseUrl: string,
	serverBaseUrl: string,
	referer?: string
): string => {
	const lines = manifestContent.split("\n");

	const rewrittenLines = lines.map((line) => {
		const trimmedLine = line.trim();
		if (!trimmedLine) return line;

		// 1. Handle URLs inside tags like URI="...", etc.
		if (trimmedLine.startsWith("#")) {
			return trimmedLine.replace(/(URI=["']?)([^"'\s>]+)(["']?)/gi, (match, prefix, originalUri, suffix) => {
				const absoluteUri = resolveAbsoluteUrl(originalUri, manifestBaseUrl);
				const proxiedUri = createProxiedUrl(absoluteUri, serverBaseUrl, referer);
				return `${prefix}${proxiedUri}${suffix}`;
			});
		}

		// 2. Handle plain URL lines
		const absoluteSegmentUrl = resolveAbsoluteUrl(trimmedLine, manifestBaseUrl);
		return createProxiedUrl(absoluteSegmentUrl, serverBaseUrl, referer);
	});

	return rewrittenLines.join("\n");
};

// Route Handlers

router.get("/hls-manifest", (req: Request, res: Response) => {
	const { url, referer } = req.query as unknown as ProxyRequestQuery;
	if (!url) return res.status(400).send("Missing 'url' parameter");

	const serverBaseUrl = `${req.protocol}://${req.get("host")}`;
	const targetUrl = createProxiedUrl(url, serverBaseUrl, referer);
	res.redirect(targetUrl);
});

router.get("/proxy", async (req: Request, res: Response) => {
	const { url: targetUrl, referer } = req.query as unknown as ProxyRequestQuery;

	if (!targetUrl || typeof targetUrl !== "string") {
		return res.status(400).send("Missing or invalid 'url' parameter");
	}

	try {
		const serverBaseUrl = `${req.protocol}://${req.get("host")}`;
		const requestHeaders: Record<string, string> = {
			"User-Agent": DEFAULT_USER_AGENT,
		};

		// Support Range Requests for MP4 seeking/instant playback
		if (req.headers.range) {
			requestHeaders["Range"] = req.headers.range;
		}

		if (referer) {
			requestHeaders["Referer"] = referer;
			try {
				requestHeaders["Origin"] = new URL(referer).origin;
			} catch (e) {}
		}

		const axiosConfig: AxiosRequestConfig = {
			url: targetUrl,
			method: "GET",
			headers: requestHeaders,
			responseType: "stream", // Use stream to handle large files and instant playback
			timeout: 60000,
			maxRedirects: 5,
			validateStatus: () => true, // Pass through all status codes (200, 206, 302, etc.)
		};

		const response = await axios(axiosConfig);
		const finalResourceUrl = (response.request as any).res?.responseUrl || targetUrl;
		const contentType = response.headers["content-type"] || "";

		// Logic to detect if it's a manifest that needs rewriting
		const isManifest =
			targetUrl.toLowerCase().includes(".m3u8") ||
			targetUrl.toLowerCase().includes(".txt") ||
			contentType.includes("mpegurl") ||
			contentType.includes("apple.mpegurl");

		// Essential CORS and Range headers
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Accept-Ranges", "bytes");
		if (contentType) res.setHeader("Content-Type", contentType);
		if (response.headers["content-range"]) res.setHeader("Content-Range", response.headers["content-range"]);
		if (response.headers["content-length"]) res.setHeader("Content-Length", response.headers["content-length"]);

		if (isManifest) {
			// Buffer manifest text to rewrite it
			let chunks: any[] = [];
			response.data.on("data", (chunk: any) => chunks.push(chunk));
			response.data.on("end", () => {
				const manifestText = Buffer.concat(chunks).toString("utf-8");
				const rewrittenManifest = rewriteManifestContent(
					manifestText,
					finalResourceUrl,
					serverBaseUrl,
					referer
				);
				res.send(rewrittenManifest);
			});
		} else {
			// Stream binary data directly for performance and range support
			res.status(response.status);
			response.data.pipe(res);

			req.on("close", () => {
				if (response.data) response.data.destroy();
			});
		}
	} catch (error: any) {
		console.error(`[Proxy Error] ${targetUrl.substring(0, 50)}:`, error.message);
		if (!res.headersSent) {
			res.status(500).send("Error fetching resource");
		}
	}
});

export default router;
