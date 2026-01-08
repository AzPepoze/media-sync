import { Server, Socket } from "socket.io";
import { rooms, roomUsers, roomTimeouts } from "../store";
import { User } from "../types";

const ROOM_CLEANUP_DELAY = 60000; // 1 minute

export const registerRoomHandlers = (io: Server, socket: Socket) => {
	// Join room
	socket.on("join_room", ({ roomId, nickname }: { roomId: string; nickname: string }) => {
		socket.join(roomId);
		console.log(`[Room] ${nickname} joined ${roomId}`);

		// Cancel scheduled deletion
		if (roomTimeouts[roomId]) {
			clearTimeout(roomTimeouts[roomId]);
			delete roomTimeouts[roomId];
		}

		// Initialize room if needed
		if (!rooms[roomId]) {
			rooms[roomId] = {
				videoUrl: null,
				referer: null,
				isPlaying: false,
				currentTime: 0,
				lastUpdated: 0,
				wasPlayingBeforeSeek: false,
			};
			roomUsers[roomId] = [];
		}

		// Update room time before new user joins
		const room = rooms[roomId];
		if (room.isPlaying && room.lastUpdated) {
			const elapsed = (Date.now() - room.lastUpdated) / 1000;
			room.currentTime += elapsed;
			room.lastUpdated = 0;
		}

		// Remove duplicate nicknames
		roomUsers[roomId] = roomUsers[roomId].filter((u) => u.nickname !== nickname);

		// Add new user
		const newUser: User = {
			id: socket.id,
			nickname: nickname || `User-${socket.id.slice(0, 4)}`,
			isBuffering: true, // Start buffering until loaded
		};
		roomUsers[roomId].push(newUser);

		// Send current state to new user
		socket.emit("sync_state", room);

		// Broadcast updated user list
		io.to(roomId).emit("room_users", roomUsers[roomId]);

		// Notify about buffering status
		const isBuffering = roomUsers[roomId].some((u) => u.isBuffering);
		io.to(roomId).emit("room_buffering", isBuffering);
	});

	// Handle disconnect
	socket.on("disconnecting", () => {
		for (const roomId of socket.rooms) {
			const users = roomUsers[roomId];
			if (!users) continue;

			// Remove disconnected user
			const user = users.find((u) => u.id === socket.id);
			roomUsers[roomId] = users.filter((u) => u.id !== socket.id);

			if (user) {
				console.log(`[Room] ${user.nickname} left ${roomId}`);
			}

			// Broadcast updated list
			io.to(roomId).emit("room_users", roomUsers[roomId]);

			// Check if room is empty
			if (roomUsers[roomId].length === 0) {
				console.log(`[Room] ${roomId} empty, scheduling cleanup`);
				roomTimeouts[roomId] = setTimeout(() => {
					delete rooms[roomId];
					delete roomUsers[roomId];
					delete roomTimeouts[roomId];
					console.log(`[Room] ${roomId} deleted`);
				}, ROOM_CLEANUP_DELAY);
			} else {
				// Update buffering status
				const isBuffering = roomUsers[roomId].some((u) => u.isBuffering);
				io.to(roomId).emit("room_buffering", isBuffering);
			}
		}
	});
};
