import { Server, Socket } from "socket.io";
import { rooms, roomUsers, roomTimeouts } from "../store";
import { User } from "../types";

export const registerRoomHandlers = (io: Server, socket: Socket) => {
	socket.on("join_room", ({ roomId, nickname }: { roomId: string; nickname: string }) => {
		socket.join(roomId);
		console.log(`User ${nickname} (${socket.id}) joined room ${roomId}`);

		// Clear deletion timeout if someone joins
		if (roomTimeouts[roomId]) {
			clearTimeout(roomTimeouts[roomId]);
			delete roomTimeouts[roomId];
			console.log(`Deletion cancelled for room ${roomId}`);
		}

		// Init Room
		if (!rooms[roomId]) {
			rooms[roomId] = {
				videoUrl: null,
				referer: null,
				isPlaying: false,
				currentTime: 0,
				lastUpdated: Date.now(),
			};
			roomUsers[roomId] = [];
		}

		// Add User to List
		const newUser: User = {
			id: socket.id,
			nickname: nickname || `User ${socket.id.substring(0, 4)}`,
			isBuffering: false,
		};
		roomUsers[roomId].push(newUser);

		// Send current room state to the new user
		socket.emit("sync_state", rooms[roomId]);

		// Broadcast new user list to everyone in room
		io.to(roomId).emit("room_users", roomUsers[roomId]);

		// Check buffering status
		const isRoomBuffering = roomUsers[roomId].some((u) => u.isBuffering);
		if (isRoomBuffering) {
			socket.emit("room_buffering", true);
		}
	});

	socket.on("disconnecting", () => {
		for (const roomId of socket.rooms) {
			if (roomUsers[roomId]) {
				// Remove user
				roomUsers[roomId] = roomUsers[roomId].filter((u) => u.id !== socket.id);

				// Update list to others
				io.to(roomId).emit("room_users", roomUsers[roomId]);

				// Check if room is now empty
				if (roomUsers[roomId].length === 0) {
					console.log(`Room ${roomId} is empty. Scheduling deletion in 1 minute.`);
					roomTimeouts[roomId] = setTimeout(() => {
						delete rooms[roomId];
						delete roomUsers[roomId];
						delete roomTimeouts[roomId];
						console.log(`Room ${roomId} has been deleted due to inactivity.`);
					}, 60000); // 1 minute
				}

				// Check buffering again (in case the disconnected user was holding the lock)
				const anyBuffering = roomUsers[roomId].some((u) => u.isBuffering);
				if (!anyBuffering && rooms[roomId]) {
					io.to(roomId).emit("room_buffering", false);
				}
			}
		}
	});
};
