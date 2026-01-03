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

const isHlsManifest = (contentType: string | undefined, dataSnippet: string): boolean => {
	return (
		(contentType?.includes("mpegurl") ?? false) ||
		(contentType?.includes("apple.mpegurl") ?? false) ||
		dataSnippet.trim().startsWith("#EXTM3U")
	);
};

const createProxiedUrl = (targetUrl: string, serverBaseUrl: string, referer?: string): string => {
	try {
		const encodedUrl = encodeURIComponent(targetUrl);
		let proxyUrl = `${serverBaseUrl}/proxy?url=${encodedUrl}`;

		if (referer) {
			proxyUrl += `&referer=${encodeURIComponent(referer)}`;
		}

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

		const absoluteSegmentUrl = resolveAbsoluteUrl(trimmedLine, manifestBaseUrl);
		return createProxiedUrl(absoluteSegmentUrl, serverBaseUrl, referer);
	});

	return rewrittenLines.join("\n");
};

// Route Handlers

router.get("/hls-manifest", (req: Request, res: Response) => {
	const { url, referer } = req.query as unknown as ProxyRequestQuery;

	if (!url) {
		return res.status(400).send("Missing 'url' parameter");
	}

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
		const protocol = req.headers["x-forwarded-proto"] || req.protocol;
		const host = req.get("host");
		const serverBaseUrl = `${protocol}://${host}`;

		const requestHeaders: Record<string, string> = {
			"User-Agent": DEFAULT_USER_AGENT,
		};

		if (referer) {
			requestHeaders["Referer"] = referer;
			try {
				requestHeaders["Origin"] = new URL(referer).origin;
			} catch (error) {
				// Ignore error
			}
		}

		const axiosConfig: AxiosRequestConfig = {
			headers: requestHeaders,
			responseType: "arraybuffer",
			timeout: 30000,
			maxRedirects: 5,
			validateStatus: (status) => status < 400,
		};

		const response = await axios.get(targetUrl, axiosConfig);
		const finalResourceUrl = response.request.res.responseUrl || targetUrl;
		const contentType = response.headers["content-type"];
		const responseBuffer = response.data as Buffer;

		const dataSnippet = responseBuffer.subarray(0, 50).toString("utf-8");

		if (isHlsManifest(contentType, dataSnippet)) {
			const manifestText = responseBuffer.toString("utf-8");
			const rewrittenManifest = rewriteManifestContent(manifestText, finalResourceUrl, serverBaseUrl, referer);

			res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.send(rewrittenManifest);
		} else {
			res.setHeader("Content-Type", contentType || "application/octet-stream");
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.send(responseBuffer);
		}
	} catch (error: any) {
		if (axios.isAxiosError(error)) {
			res.status(error.response?.status || 500).send("Error fetching resource");
		} else {
			res.status(500).send("Internal Server Error");
		}
	}
});

export default router;
