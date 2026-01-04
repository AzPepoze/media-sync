import { Server, Socket } from "socket.io";
import { rooms, roomUsers } from "../store";
import { resolveVideoUrl } from "../utils/ytdlp";

export const registerPlayerHandlers = (io: Server, socket: Socket) => {
	socket.on("set_url", async ({ roomId, url, referer }: { roomId: string; url: string; referer?: string }) => {
		if (rooms[roomId]) {
			const finalUrl = await resolveVideoUrl(url);
			rooms[roomId].videoUrl = finalUrl;
			rooms[roomId].referer = referer || null;
			rooms[roomId].currentTime = 0;
			rooms[roomId].isPlaying = true;
			rooms[roomId].lastUpdated = Date.now();
			io.to(roomId).emit("sync_state", rooms[roomId]);
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
			socket.to(roomId).emit("player_action", { action: "seek", time });
		}
	});

	// Buffering Logic Helper
	const updateBuffering = (roomId: string, socketId: string, isBuffering: boolean) => {
		if (!roomUsers[roomId]) return;

		const user = roomUsers[roomId].find((u) => u.id === socketId);
		if (user) {
			user.isBuffering = isBuffering;
			// Broadcast user update (so we can see who is buffering in the list)
			io.to(roomId).emit("room_users", roomUsers[roomId]);
		}

		const anyBuffering = roomUsers[roomId].some((u) => u.isBuffering);
		io.to(roomId).emit("room_buffering", anyBuffering);

		if (!anyBuffering && rooms[roomId].isPlaying) {
			// Resume if everyone ready
			io.to(roomId).emit("player_action", { action: "play", time: rooms[roomId].currentTime });
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
		}
	});
};
