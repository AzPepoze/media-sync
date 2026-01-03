import { Router } from "express";
import axios from "axios";

const router = Router();
const isUrl = (line: string) => line.trim() && !line.trim().startsWith("#");

// HLS Manifest Proxy & Rewriter
router.get("/hls-manifest", async (req, res) => {
	const { url, referer } = req.query;
	if (!url || typeof url !== "string") {
		res.status(400).send("Missing url parameter");
		return;
	}

	try {
		const protocol = req.headers["x-forwarded-proto"] || req.protocol;
		const host = req.get("host");
		const serverBaseUrl = `${protocol}://${host}`;

		console.log(`[HLS-Proxy] Fetching manifest: ${url}`);

		const headers: Record<string, string> = {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		};

		if (typeof referer === "string") {
			headers["Referer"] = referer;
			try {
				headers["Origin"] = new URL(referer).origin;
			} catch (e) {}
		}

		const manifestResponse = await axios.get(url, { headers, responseType: "text" });
		const lines = manifestResponse.data.split("\n");

		// Rewrite URLs to go through our /proxy endpoint to bypass CORS for segments
		const rewrittenLines = lines.map((line: string) => {
			if (isUrl(line)) {
				try {
					const absoluteUrl = new URL(line.trim(), url).toString();
					let proxyUrl = `${serverBaseUrl}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
					if (typeof referer === "string") {
						proxyUrl += `&referer=${encodeURIComponent(referer)}`;
					}
					return proxyUrl;
				} catch (e) {
					return line;
				}
			}
			return line;
		});

		res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.send(rewrittenLines.join("\n"));
	} catch (error: any) {
		console.error("HLS Manifest Error:", error.message);
		res.status(500).send("Error fetching manifest");
	}
});

// Proxy Endpoint for video segments
router.get("/proxy", async (req, res) => {
	const { url, referer } = req.query;
	if (!url || typeof url !== "string") {
		res.status(400).send("Missing url parameter");
		return;
	}

	try {
		const headers: Record<string, string> = {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		};

		if (referer && typeof referer === "string") {
			headers["Referer"] = referer;
			try {
				headers["Origin"] = new URL(referer).origin;
			} catch (e) {}
		}

		const response = await axios({
			url: url,
			method: "GET",
			responseType: "stream",
			headers: headers,
			timeout: 15000,
			maxRedirects: 5,
		});

		if (response.headers["content-type"]) {
			res.setHeader("Content-Type", response.headers["content-type"]);
		}
		res.setHeader("Access-Control-Allow-Origin", "*");

		response.data.pipe(res);
	} catch (error: any) {
		console.error("Proxy Error:", error.message);
		res.status(500).send("Error proxying resource");
	}
});

export default router;
