import { Server, Socket } from "socket.io";
import { rooms, roomUsers } from "../store";
import { resolveVideoUrl } from "../utils/ytdlp";

export const registerPlayerHandlers = (io: Server, socket: Socket) => {
	socket.on("set_url", async ({ roomId, url, referer }: { roomId: string; url: string; referer?: string }) => {
		if (rooms[roomId]) {
			console.log(`[Player] Request to set URL in room ${roomId}: ${url}`);

			// Notify everyone immediately that we are processing
			io.to(roomId).emit("video_changing");

			try {
				const resolved = await resolveVideoUrl(url);

				// Update room state only with the resolved direct URL
				rooms[roomId].videoUrl = resolved.url;

				// Use only resolved referer or user-provided referer.
				const finalReferer = resolved.referer || referer;
				rooms[roomId].referer = finalReferer && finalReferer.trim() !== "" ? finalReferer : null;

				rooms[roomId].currentTime = 0;
				rooms[roomId].isPlaying = true;
				rooms[roomId].lastUpdated = Date.now();

				console.log(`[Player] URL resolved successfully for room ${roomId}`);
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
			socket.to(roomId).emit("player_action", { action: "play", time });
		}
	});

	socket.on("pause", ({ roomId, time }: { roomId: string; time: number }) => {
		if (rooms[roomId]) {
			rooms[roomId].isPlaying = false;
			rooms[roomId].currentTime = time;
			socket.to(roomId).emit("player_action", { action: "pause", time });
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
		io.to(roomId).emit("room_buffering", anyBuffering);

		if (!anyBuffering && rooms[roomId].isPlaying) {
			// Calculate where the video should be right now
			let syncTime = rooms[roomId].currentTime;
			if (rooms[roomId].lastUpdated) {
				const elapsed = (Date.now() - rooms[roomId].lastUpdated) / 1000;
				syncTime += elapsed;
			}

			// Update server state to this new point
			rooms[roomId].currentTime = syncTime;
			rooms[roomId].lastUpdated = Date.now();

			// Resume everyone at the precisely calculated time
			io.to(roomId).emit("player_action", { action: "play", time: syncTime });
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
