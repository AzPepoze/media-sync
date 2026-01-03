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

const getServerBaseUrl = (req: Request): string => {
	// Prioritize X-Forwarded-Proto header because the app is likely behind a reverse proxy
	// that terminates SSL. req.protocol might default to 'http' if 'trust proxy' isn't set.
	let protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol;
	if (Array.isArray(protocol)) protocol = protocol[0];
	if (protocol.includes(",")) protocol = protocol.split(",")[0].trim();

	return `${protocol}://${req.get("host")}`;
};

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

		// Handle Tags (starting with #)
		if (trimmedLine.startsWith("#")) {
			if (trimmedLine.includes("URI=")) {
				return trimmedLine.replace(
					/(URI=["']?)([^"'\s>]+)(["']?)/gi,
					(match, prefix, originalUri, suffix) => {
						const absoluteUri = resolveAbsoluteUrl(originalUri, manifestBaseUrl);
						const proxiedUri = createProxiedUrl(absoluteUri, serverBaseUrl, referer);
						return `${prefix}${proxiedUri}${suffix}`;
					}
				);
			}
			return line;
		}

		// Handle Segment URLs
		const absoluteSegmentUrl = resolveAbsoluteUrl(trimmedLine, manifestBaseUrl);
		return createProxiedUrl(absoluteSegmentUrl, serverBaseUrl, referer);
	});

	return rewrittenLines.join("\n");
};

// Route Handlers
router.get("/proxy", async (req: Request, res: Response) => {
	const { url: targetUrl, referer } = req.query as unknown as ProxyRequestQuery;

	if (!targetUrl || typeof targetUrl !== "string") {
		return res.status(400).send("Missing or invalid 'url' parameter");
	}

	try {
		const serverBaseUrl = getServerBaseUrl(req);
		const requestHeaders: Record<string, string> = {
			"User-Agent": DEFAULT_USER_AGENT,
		};

		// [Crucial for MP4] Forward Range header (requested bytes)
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
			responseType: "stream", // Always use stream to handle large files
			timeout: 60000,
			maxRedirects: 5,
			validateStatus: () => true, // Accept all status codes (including 206 Partial Content)
		};

		const response = await axios(axiosConfig);
		const finalResourceUrl = (response.request as any).res?.responseUrl || targetUrl;
		const contentType = response.headers["content-type"] || "";

		// [CHECK] If upstream returns error (e.g. 403, 404), forward it immediately
		if (response.status >= 400) {
			res.status(response.status);
			if (contentType) res.setHeader("Content-Type", contentType);
			response.data.pipe(res);
			return;
		}

		// Check if it looks like a manifest based on URL or Content-Type
		const isManifest =
			targetUrl.toLowerCase().includes(".m3u8") ||
			contentType.includes("mpegurl") ||
			contentType.includes("apple.mpegurl");

		// Set basic CORS headers
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Headers", "Range");
		res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");

		if (isManifest) {
			// --- MANIFEST LOGIC (Buffer -> Rewrite -> Send) ---

			// Collect stream into buffer
			const chunks: any[] = [];
			response.data.on("data", (chunk: any) => chunks.push(chunk));

			response.data.on("end", () => {
				const buffer = Buffer.concat(chunks);
				// Axios handles decompression, so we can just convert to string
				const manifestText = buffer.toString("utf-8");

				// Double check content signature just to be safe
				if (manifestText.startsWith("#EXTM3U")) {
					const rewrittenManifest = rewriteManifestContent(
						manifestText,
						finalResourceUrl,
						serverBaseUrl,
						referer
					);
					res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
					res.send(rewrittenManifest);
				} else {
					// Not a real manifest? Send raw buffer
					if (contentType) res.setHeader("Content-Type", contentType);
					res.send(buffer);
				}
			});

			response.data.on("error", () => {
				if (!res.headersSent) res.status(500).send("Error reading manifest stream");
			});
		} else {
			// --- MP4/BINARY LOGIC (Pipe Stream Directly) ---

			// Forward critical headers for streaming
			if (contentType) res.setHeader("Content-Type", contentType);

			// NOTE: We do NOT forward Content-Length or Content-Encoding here.
			// Since Axios decompresses the stream, the size changes, so the original Content-Length is invalid.
			// We let Node.js handle the transfer encoding (Chunked) automatically.

			if (response.headers["accept-ranges"]) res.setHeader("Accept-Ranges", response.headers["accept-ranges"]);
			if (response.headers["content-range"]) res.setHeader("Content-Range", response.headers["content-range"]);

			// Forward the status code (200 OK or 206 Partial Content)
			res.status(response.status);

			// Pipe data directly to client (efficient for large files)
			response.data.pipe(res);

			// Cleanup
			response.data.on("error", (err: any) => {
				// console.error("Stream error", err);
				if (!res.headersSent) res.end();
			});

			req.on("close", () => {
				if (response.data && typeof response.data.destroy === "function") {
					response.data.destroy();
				}
			});
		}
	} catch (error: any) {
		if (!res.headersSent) {
			res.status(500).send("Error fetching resource");
		}
	}
});

export default router;
