import { Router } from "express";
import { resolveVideoUrl } from "../utils/getVideoUrl";

const router = Router();

// GET /resolve?url=...&roomId=...
router.get("/resolve", async (req, res) => {
	const targetUrl = (req.query.url as string) || "";
	const roomId = (req.query.roomId as string) || "";
	if (!targetUrl) return res.status(400).json({ error: "missing url" });
	if (!roomId) return res.status(400).json({ error: "missing roomId" });

	try {
		const resolved = await resolveVideoUrl(roomId, targetUrl);
		return res.json(resolved);
	} catch (e: any) {
		console.error("/resolve error:", e?.message || e);
		return res.status(500).json({ error: "unable to resolve url" });
	}
});

export default router;
