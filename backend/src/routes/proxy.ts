import { Router, Request, Response } from "express";
import axios, { AxiosRequestConfig } from "axios";
import { URL } from "url";
import { getCachedChunk, createCachedChunk, markChunkLoaded, markChunkLoadingStart } from "../store";

const router = Router();

// Constants & Types

const DEFAULT_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FRONTEND_URL = process.env.FRONTEND_URL || "*";

interface ProxyRequestQuery {
	url?: string;
	referer?: string;
	proxySegments?: string;
	roomId?: string;
	socketId?: string;
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

const createProxiedUrl = (targetUrl: string, serverBaseUrl: string, referer?: string, roomId?: string): string => {
	try {
		const encodedUrl = encodeURIComponent(targetUrl);
		let proxyUrl = `${serverBaseUrl}/proxy?url=${encodedUrl}`;
		if (referer) proxyUrl += `&referer=${encodeURIComponent(referer)}`;
		if (roomId) proxyUrl += `&roomId=${encodeURIComponent(roomId)}`;
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
	referer?: string,
	proxySegments?: boolean,
	roomId?: string
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
						// For keys/sub-manifests inside EXT-X-KEY, we might still need proxy if they are protected.
						// But if the goal is direct access, let's return absolute URI.
						// If it fails, we can revert to proxied URI for keys.
						return `${prefix}${absoluteUri}${suffix}`;
					}
				);
			}
			return line;
		}

		// Handle Segment URLs
		const absoluteSegmentUrl = resolveAbsoluteUrl(trimmedLine, manifestBaseUrl);

		if (proxySegments) {
			// For Mobile: Route everything through proxy
			return createProxiedUrl(absoluteSegmentUrl, serverBaseUrl, referer, roomId);
		} else {
			// For Desktop: Direct access (Absolute URL)
			return absoluteSegmentUrl;
		}
	});

	return rewrittenLines.join("\n");
};

// Route Handlers
router.get("/proxy", async (req: Request, res: Response) => {
	const { url: targetUrl, referer, proxySegments, roomId, socketId } = req.query as unknown as ProxyRequestQuery;
	const shouldProxySegments = proxySegments === "true";

	if (!targetUrl || typeof targetUrl !== "string") {
		return res.status(400).send("Missing or invalid 'url' parameter");
	}

	// Generate chunk key for caching (URL + Range header for partial requests)
	const rangeHeader = req.headers.range || "";
	const chunkKey = `${targetUrl}:${rangeHeader}`;

	// Check if this is a segment request with room context - try cache first
	const isSegmentRequest = roomId && socketId && !targetUrl.toLowerCase().includes(".m3u8");

	if (isSegmentRequest) {
		const cached = getCachedChunk(roomId, chunkKey);
		if (cached) {
			// Mark user as loading (for timeout protection)
			markChunkLoadingStart(roomId, chunkKey, socketId);

			// Serve from cache
			res.setHeader("Access-Control-Allow-Origin", FRONTEND_URL);
			res.setHeader("Access-Control-Allow-Headers", "Range");
			res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");
			res.setHeader("Content-Type", cached.contentType);
			res.setHeader("X-Cache", "HIT");

			// Forward cached headers
			for (const [key, value] of Object.entries(cached.headers)) {
				res.setHeader(key, value);
			}

			res.send(cached.data);

			// Mark this user as having loaded the chunk (may delete it)
			markChunkLoaded(roomId, chunkKey, socketId);
			return;
		}
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
			targetUrl.toLowerCase().includes(".txt") ||
			contentType.includes("mpegurl") ||
			contentType.includes("apple.mpegurl");

		// Set basic CORS headers
		res.setHeader("Access-Control-Allow-Origin", FRONTEND_URL);
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
						referer,
						shouldProxySegments,
						roomId
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
			// --- SEGMENT/BINARY LOGIC ---

			// Forward critical headers for streaming
			if (contentType) res.setHeader("Content-Type", contentType);

			// NOTE: We do NOT forward Content-Length or Content-Encoding here.
			// Since Axios decompresses the stream, the size changes, so the original Content-Length is invalid.
			// We let Node.js handle the transfer encoding (Chunked) automatically.

			if (response.headers["accept-ranges"]) res.setHeader("Accept-Ranges", response.headers["accept-ranges"]);
			if (response.headers["content-range"]) res.setHeader("Content-Range", response.headers["content-range"]);

			// Forward the status code (200 OK or 206 Partial Content)
			res.status(response.status);

			// If this is a segment request with room context, buffer and cache for other users
			if (isSegmentRequest && roomId && socketId) {
				const chunks: Buffer[] = [];

				response.data.on("data", (chunk: Buffer) => {
					chunks.push(chunk);
				});

				response.data.on("end", () => {
					const buffer = Buffer.concat(chunks);

					// Cache for other users in the room
					const headersToCache: Record<string, string> = {};
					if (response.headers["accept-ranges"])
						headersToCache["Accept-Ranges"] = response.headers["accept-ranges"];
					if (response.headers["content-range"])
						headersToCache["Content-Range"] = response.headers["content-range"];

					createCachedChunk(roomId, chunkKey, buffer, contentType, headersToCache, socketId);

					res.setHeader("X-Cache", "MISS");
					res.send(buffer);
				});

				response.data.on("error", (err: any) => {
					if (!res.headersSent) res.status(500).send("Error reading stream");
				});

				req.on("close", () => {
					if (response.data && typeof response.data.destroy === "function") {
						response.data.destroy();
					}
				});
			} else {
				// No room context - pipe directly (efficient for large files)
				response.data.pipe(res);

				// Cleanup
				response.data.on("error", (err: any) => {
					if (!res.headersSent) res.end();
				});

				req.on("close", () => {
					if (response.data && typeof response.data.destroy === "function") {
						response.data.destroy();
					}
				});
			}
		}
	} catch (error: any) {
		if (!res.headersSent) {
			res.status(500).send("Error fetching resource");
		}
	}
});

export default router;
