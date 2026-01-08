import { writable, get } from "svelte/store";
import { io, Socket } from "socket.io-client";
import type { User, RoomState } from "../types";

// Stores
export const socket = writable<Socket | null>(null);
export const isConnected = writable(false);
export const isJoined = writable(false);
export const currentRoomId = writable<string>("");
export const users = writable<User[]>([]);
export const roomState = writable<RoomState>({
	videoUrl: null,
	referer: null,
	isPlaying: false,
	currentTime: 0,
	lastUpdated: 0,
});
export const isWaitingForOthers = writable(false);
export const isVideoChanging = writable(false);
export const roomError = writable<string | null>(null);

export const SERVER_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
let socketInstance: Socket | null = null;

// Initialize socket connection
export function initSocket() {
	if (socketInstance) return socketInstance;

	socketInstance = io(SERVER_URL, {
		reconnection: true,
		reconnectionDelay: 1000,
		reconnectionAttempts: 5,
	});

	socket.set(socketInstance);

	// Connection events
	socketInstance.on("connect", () => {
		console.log("[Socket] Connected");
		isConnected.set(true);
	});

	socketInstance.on("disconnect", (reason) => {
		console.log("[Socket] Disconnected:", reason);
		isConnected.set(false);
	});

	// Room state events
	socketInstance.on("sync_state", (state: RoomState) => {
		console.log("[Socket] State sync:", state);
		roomState.set(state);
		isVideoChanging.set(false);
	});

	socketInstance.on("video_changing", () => {
		console.log("[Socket] Video changing");
		isVideoChanging.set(true);
	});

	// User management
	socketInstance.on("room_users", (list: User[]) => {
		console.log("[Socket] Users updated:", list.length);
		users.set(list);
	});

	// Buffering
	socketInstance.on("room_buffering", (isBuffering: boolean) => {
		console.log("[Socket] Room buffering:", isBuffering);
		isWaitingForOthers.set(isBuffering);
	});

	// Player actions from other users
	socketInstance.on("player_action", (data: { action: string; time: number }) => {
		console.log("[Socket] Player action:", data.action, data.time.toFixed(2));

		roomState.update((state) => {
			const newState = { ...state };

			if (data.action === "play") {
				newState.isPlaying = true;
				newState.currentTime = data.time;
				newState.lastUpdated = Date.now();
			} else if (data.action === "pause") {
				newState.isPlaying = false;
				newState.currentTime = data.time;
				newState.lastUpdated = 0;
			} else if (data.action === "seek") {
				newState.currentTime = data.time;
				if (newState.isPlaying) {
					newState.lastUpdated = Date.now();
				}
			}

			return newState;
		});
	});

	// Errors
	socketInstance.on("room_error", (msg: string) => {
		console.error("[Socket] Error:", msg);
		roomError.set(msg);
		setTimeout(() => roomError.set(null), 5000);
	});

	return socketInstance;
}

// Join a room
export function joinRoom(roomId: string, nickname: string) {
	const sock = socketInstance || initSocket();

	sock.emit("join_room", { roomId, nickname });
	localStorage.setItem("nickname", nickname);

	currentRoomId.set(roomId);
	isJoined.set(true);

	// Update URL
	const url = new URL(window.location.href);
	url.searchParams.set("room_id", roomId);
	window.history.pushState({}, "", url.toString());
}

// Leave room
export function leaveRoom() {
	isJoined.set(false);
	currentRoomId.set("");
	localStorage.removeItem("roomId");
	window.history.pushState({}, "", "/");
}

// Set video URL
export function setUrl(roomId: string, url: string, referer: string) {
	socketInstance?.emit("set_url", { roomId, url, referer });
}

// Emit player actions
export function emitPlay(time: number) {
	const roomId = get(currentRoomId);
	socketInstance?.emit("play", { roomId, time });
}

export function emitPause(time: number) {
	const roomId = get(currentRoomId);
	socketInstance?.emit("pause", { roomId, time });
}

export function emitSeek(time: number) {
	const roomId = get(currentRoomId);
	socketInstance?.emit("seek", { roomId, time });
}

export function emitBufferingStart() {
	const roomId = get(currentRoomId);
	socketInstance?.emit("buffering_start", roomId);
}

export function emitBufferingEnd() {
	const roomId = get(currentRoomId);
	socketInstance?.emit("buffering_end", roomId);
}

// Legacy support
export function emitAction(action: string, data: any) {
	socketInstance?.emit(action, data);
}

// Cleanup
export function cleanupSocket() {
	if (socketInstance) {
		socketInstance.disconnect();
		socketInstance = null;
		socket.set(null);
	}
}
