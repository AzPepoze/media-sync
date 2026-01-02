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
		if (referer) {
			console.log(`[HLS-Proxy] Using Referer: ${referer}`);
		} else {
			console.log(`[HLS-Proxy] No Referer provided.`);
		}

		// 1. Fetch the original manifest
		const headers: Record<string, string> = {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		};

		if (typeof referer === "string") {
			headers["Referer"] = referer;
			try {
				headers["Origin"] = new URL(referer).origin;
			} catch (e) {
				console.log("[HLS-Proxy] Could not parse Origin from Referer");
			}
		}

		const manifestResponse = await axios.get(url, { headers, responseType: "text" });
		let manifestContent = manifestResponse.data;

		// 2. Rewrite URLs inside the manifest
		const lines = manifestContent.split("\n");
		const rewrittenLines = lines.map((line: string) => {
			if (isUrl(line)) {
				// Resolve relative URL against the manifest's URL
				const absoluteUrl = new URL(line.trim(), url).toString();
				// Wrap it in our proxy AND pass the referer along!
				let proxyUrl = `${serverBaseUrl}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
				if (typeof referer === "string") {
					proxyUrl += `&referer=${encodeURIComponent(referer)}`;
				}
				return proxyUrl;
			}
			return line;
		});

		const rewrittenManifest = rewrittenLines.join("\n");

		// Debug: Print first 5 lines of rewritten manifest
		console.log("--- Rewritten Manifest Preview ---");
		console.log(rewrittenLines.slice(0, 5).join("\n"));
		console.log("----------------------------------");

		// 3. Return the modified manifest
		res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
		res.send(rewrittenManifest);
	} catch (error: any) {
		console.error("HLS Manifest Error:", error.message);
		res.status(500).send("Error fetching manifest");
	}
});

// Proxy Endpoint to bypass CORS/Referer checks
router.get("/proxy", async (req, res) => {
	const { url, referer } = req.query;
	if (!url || typeof url !== "string") {
		res.status(400).send("Missing url parameter");
		return;
	}

	try {
		const targetUrl = new URL(url);

		// FINAL ATTEMPT STRATEGY: "Naked Request" mimic unless referer is forced
		// Mimic the user pasting the URL directly into the browser address bar.

		let headers: Record<string, string> = {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
		};

		// If a referer is explicitly provided by the HLS rewriter, use it!
		if (referer && typeof referer === "string") {
			headers["Referer"] = referer;
			try {
				headers["Origin"] = new URL(referer).origin;
			} catch (e) {}
			console.log(`[Proxy] Using provided Referer: ${referer}`);
		} else {
			// Otherwise, go naked (delete headers)
			delete headers["Referer"];
			delete headers["Origin"];
			console.log(`[Proxy] Fetching "Naked": ${url}`);
		}

		const response = await axios({
			url: url,
			method: "GET",
			responseType: "stream",
			headers: headers,
			timeout: 10000,
			maxRedirects: 5,
		});

		if (response.headers["content-type"]) {
			res.setHeader("Content-Type", response.headers["content-type"]);
		}

		response.data.pipe(res);
	} catch (error: any) {
		if (error.response) {
			console.error(`Proxy Upstream Error: ${error.response.status} for ${url}`);
			res.status(error.response.status).send(`Upstream returned ${error.response.status}`);
		} else {
			console.error("Proxy Request Error:", error.message);
			res.status(500).send("Error fetching URL: " + error.message);
		}
	}
});

export default router;
