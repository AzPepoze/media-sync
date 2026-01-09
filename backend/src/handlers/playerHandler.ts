import { Server, Socket } from "socket.io";
import { rooms, roomUsers } from "../store";
import { resolveVideoUrl } from "../utils/getVideoUrl";

// Helper: Update room time based on elapsed duration
function updateRoomTime(roomId: string) {
	const room = rooms[roomId];
	if (!room) return;

	if (room.isPlaying && room.lastUpdated) {
		const elapsed = (Date.now() - room.lastUpdated) / 1000;
		room.currentTime += elapsed;
		room.lastUpdated = Date.now();
	}
}

// Helper: Sync room state to all clients
function syncRoomState(io: Server, roomId: string) {
	if (!rooms[roomId]) return;
	updateRoomTime(roomId);
	io.to(roomId).emit("sync_state", rooms[roomId]);
}

export const registerPlayerHandlers = (io: Server, socket: Socket) => {
	// Set video URL
	socket.on("set_url", async ({ roomId, url, referer }: { roomId: string; url: string; referer?: string }) => {
		const room = rooms[roomId];
		if (!room) return;

		const cleanUrl = url.trim();
		console.log(`[Player] Setting URL in room ${roomId}`);

		io.to(roomId).emit("video_changing");

		try {
			let finalUrl = cleanUrl;
			let finalReferer = referer;

			const isYoutube = /^(https?\:\/\/)?((www\.)?youtube\.com|youtu\.?be)\/.+$/.test(cleanUrl);

			if (!isYoutube) {
				const resolved = await resolveVideoUrl(roomId, cleanUrl);
				finalUrl = resolved.url;
				finalReferer = resolved.referer || referer;
			}

			room.videoUrl = finalUrl;
			room.referer = finalReferer?.trim() || null;
			room.currentTime = 0;
			room.isPlaying = true;
			room.lastUpdated = Date.now();

			syncRoomState(io, roomId);
		} catch (error) {
			io.to(roomId).emit("room_error", "Failed to load video. Try a different URL.");
			console.error(`[Player] URL resolution failed:`, error);
		}
	});

	// Play
	socket.on("play", ({ roomId, time }: { roomId: string; time: number }) => {
		const room = rooms[roomId];
		if (!room) return;

		console.log(`[Player] Play in room ${roomId} at ${time.toFixed(2)}s`);

		room.isPlaying = true;
		room.currentTime = time;
		room.lastUpdated = Date.now();

		// Broadcast to ALL users including sender for perfect sync
		io.to(roomId).emit("player_action", { action: "play", time });
	});

	// Pause
	socket.on("pause", ({ roomId, time }: { roomId: string; time: number }) => {
		const room = rooms[roomId];
		if (!room) return;

		console.log(`[Player] Pause in room ${roomId} at ${time.toFixed(2)}s`);

		room.isPlaying = false;
		room.currentTime = time;
		room.lastUpdated = 0;

		// Broadcast to ALL users including sender for perfect sync
		io.to(roomId).emit("player_action", { action: "pause", time });
	});

	// Seek - SIMPLE FLOW: always pause all clients, then resume when everyone ready
	socket.on("seek", ({ roomId, time, wasPlaying }: { roomId: string; time: number; wasPlaying: boolean }) => {
		const room = rooms[roomId];
		if (!room) return;

		console.log(`[Player] Seek in room ${roomId} to ${time.toFixed(2)}s (wasPlaying: ${wasPlaying})`);

		// Store wasPlaying for later - we'll resume after everyone finishes buffering
		room.wasPlayingBeforeSeek = wasPlaying;
		// Always pause during seek
		room.isPlaying = false;
		room.currentTime = time;
		room.lastUpdated = 0;

		// Send sync_state first so clients have the updated time
		io.to(roomId).emit("sync_state", { ...room });
		// Pause all clients
		io.to(roomId).emit("player_action", { action: "pause", time });
		// Then seek all clients
		io.to(roomId).emit("player_action", { action: "seek", time });
	});

	// Buffering management
	socket.on("buffering_start", (roomId: string) => {
		const users = roomUsers[roomId];
		const room = rooms[roomId];
		if (!users || !room) return;

		const user = users.find((u) => u.id === socket.id);
		if (!user || user.isBuffering) return;

		user.isBuffering = true;
		console.log(`[Buffering] ${user.nickname} started buffering`);

		// Freeze room time if playing
		if (room.isPlaying && room.lastUpdated) {
			const elapsed = (Date.now() - room.lastUpdated) / 1000;
			room.currentTime += elapsed;
			room.lastUpdated = 0;
		}

		io.to(roomId).emit("room_users", users);
		io.to(roomId).emit("room_buffering", true);
	});

	socket.on("buffering_end", (roomId: string) => {
		const users = roomUsers[roomId];
		const room = rooms[roomId];
		if (!users || !room) return;

		const user = users.find((u) => u.id === socket.id);
		if (!user || !user.isBuffering) return;

		user.isBuffering = false;
		console.log(`[Buffering] ${user.nickname} finished buffering`);

		const anyBuffering = users.some((u) => u.isBuffering);

		io.to(roomId).emit("room_users", users);
		io.to(roomId).emit("room_buffering", anyBuffering);

		// Resume if no one is buffering and we should resume from seek
		if (!anyBuffering && room.wasPlayingBeforeSeek) {
			console.log("[Buffering] All users ready, resuming playback at", room.currentTime.toFixed(2));
			room.isPlaying = true;
			room.wasPlayingBeforeSeek = false;
			room.lastUpdated = Date.now();
			// Send sync_state first so clients have updated room state
			io.to(roomId).emit("sync_state", { ...room });
			// Send play action to all clients
			io.to(roomId).emit("player_action", { action: "play", time: room.currentTime });
		}
	});
};
