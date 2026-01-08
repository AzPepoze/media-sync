import { Server, Socket } from "socket.io";
import { rooms, roomUsers } from "../store";
import { resolveVideoUrl } from "../utils/getVideoUrl";

export const registerPlayerHandlers = (io: Server, socket: Socket) => {
	socket.on("set_url", async ({ roomId, url, referer }: { roomId: string; url: string; referer?: string }) => {
		if (rooms[roomId]) {
			const cleanUrl = url.trim();
			console.log(`[Player] Request to set URL in room ${roomId}: ${cleanUrl}`);

			// Notify everyone immediately that we are processing
			io.to(roomId).emit("video_changing");

			try {
				let finalUrl = cleanUrl;
				let finalReferer = referer;

				// Check if it is a YouTube URL
				// If it is, we DO NOT want to resolve it. We want the original link
				// so the frontend can use the YouTube Embed Player.
				const isYoutube = /^(https?\:\/\/)?((www\.)?youtube\.com|youtu\.?be)\/.+$/.test(cleanUrl);

				if (!isYoutube) {
					// Only resolve if NOT Youtube
					const resolved = await resolveVideoUrl(cleanUrl);
					finalUrl = resolved.url;
					finalReferer = resolved.referer || referer;
				} else {
					console.log(`[Player] Detected YouTube URL. Skipping resolution to keep Embed compatibility.`);
				}

				// Update room state
				rooms[roomId].videoUrl = finalUrl;
				rooms[roomId].referer = finalReferer && finalReferer.trim() !== "" ? finalReferer : null;

				rooms[roomId].currentTime = 0;
				rooms[roomId].isPlaying = true; // Auto-play
				rooms[roomId].lastUpdated = Date.now();

				console.log(`[Player] URL set successfully for room ${roomId}`);
				io.to(roomId).emit("sync_state", rooms[roomId]);
			} catch (error) {
				io.to(roomId).emit(
					"room_error",
					"Failed to resolve video URL. Please try another link or a direct media link."
				);
				console.error(`[Player] Failed to resolve URL for room ${roomId}:`, error);
			}
		}
	});

	socket.on("play", ({ roomId, time }: { roomId: string; time: number }) => {
		if (rooms[roomId]) {
			rooms[roomId].isPlaying = true;
			rooms[roomId].currentTime = time;
			rooms[roomId].lastUpdated = Date.now();
			io.to(roomId).emit("player_action", { action: "play", time });
		}
	});

	socket.on("pause", ({ roomId, time }: { roomId: string; time: number }) => {
		if (rooms[roomId]) {
			rooms[roomId].isPlaying = false;
			rooms[roomId].currentTime = time;
			io.to(roomId).emit("player_action", { action: "pause", time });
		}
	});

	socket.on("seek", ({ roomId, time }: { roomId: string; time: number }) => {
		if (rooms[roomId]) {
			rooms[roomId].currentTime = time;
			rooms[roomId].lastUpdated = Date.now();
			io.to(roomId).emit("player_action", { action: "seek", time });
		}
	});

	// Buffering Logic Helper
	const updateBuffering = (roomId: string, socketId: string, isBuffering: boolean) => {
		if (!roomUsers[roomId] || !rooms[roomId]) return;

		const user = roomUsers[roomId].find((u) => u.id === socketId);
		if (user) {
			user.isBuffering = isBuffering;
			io.to(roomId).emit("room_users", roomUsers[roomId]);
		}

		const anyBuffering = roomUsers[roomId].some((u) => u.isBuffering);

		// If someone starts buffering and it was playing,
		// "freeze" the time by setting lastUpdated to null
		if (anyBuffering && rooms[roomId].isPlaying && rooms[roomId].lastUpdated) {
			const elapsed = (Date.now() - rooms[roomId].lastUpdated) / 1000;
			rooms[roomId].currentTime += elapsed;
			rooms[roomId].lastUpdated = 0; // Freeze the clock
			console.log(`[Buffering] Room ${roomId} time frozen at ${rooms[roomId].currentTime}`);
		}

		io.to(roomId).emit("room_buffering", anyBuffering);

		if (!anyBuffering) {
			if (rooms[roomId].isPlaying) {
				rooms[roomId].lastUpdated = Date.now();
				console.log(`[Buffering] Room ${roomId} resumed at ${rooms[roomId].currentTime}`);
				io.to(roomId).emit("player_action", { action: "play", time: rooms[roomId].currentTime });
			} else {
				console.log(`[Buffering] Room ${roomId} ready (paused) at ${rooms[roomId].currentTime}`);
			}
		}
	};
	socket.on("buffering_start", (roomId: string) => {
		updateBuffering(roomId, socket.id, true);
	});

	socket.on("buffering_end", (roomId: string) => {
		updateBuffering(roomId, socket.id, false);
	});

	// Heartbeat for time sync
	socket.on("time_update", ({ roomId, time }: { roomId: string; time: number }) => {
		if (rooms[roomId] && rooms[roomId].isPlaying) {
			rooms[roomId].currentTime = time;
			rooms[roomId].lastUpdated = Date.now();
		}
	});
};
