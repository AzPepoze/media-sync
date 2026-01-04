import { writable } from "svelte/store";
import { io, Socket } from "socket.io-client";
import type { User, RoomState } from "../types";

// --- Stores ---
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

// --- Actions ---
const SERVER_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
let socketInstance: Socket;

export function initSocket() {
	if (socketInstance) return;

	socketInstance = io(SERVER_URL);
	socket.set(socketInstance);

	socketInstance.on("connect", () => {
		console.log("[Socket] Connected:", socketInstance.id);
		isConnected.set(true);

		// Auto re-join if we have the info
		const savedRoomId = localStorage.getItem("roomId");
		const savedNickname = localStorage.getItem("nickname");
		if (savedRoomId && savedNickname) {
			console.log("[Socket] Auto-rejoining room:", savedRoomId);
			socketInstance.emit("join_room", { roomId: savedRoomId, nickname: savedNickname });
			isJoined.set(true);
			currentRoomId.set(savedRoomId);
		}
	});

	socketInstance.on("disconnect", (reason) => {
		console.log("[Socket] Disconnected:", reason);
		isConnected.set(false);
	});

	socketInstance.on("sync_state", (state: RoomState) => {
		console.log("[Socket] Sync state received:", state);
		roomState.set(state);
		isVideoChanging.set(false);
	});

	socketInstance.on("video_changing", () => {
		console.log("[Socket] Video is changing...");
		isVideoChanging.set(true);
	});

	socketInstance.on("room_users", (list: User[]) => {
		console.log("[Socket] Room users updated:", list);
		users.set(list);
	});

	socketInstance.on("room_buffering", (isBuffering: boolean) => {
		console.log("[Socket] Room buffering status:", isBuffering);
		isWaitingForOthers.set(isBuffering);
	});

	socketInstance.on("room_error", (msg: string) => {
		console.error("[Socket] Room error received:", msg);
		roomError.set(msg);
		// Auto-clear error after 5 seconds
		setTimeout(() => roomError.set(null), 5000);
	});

	socketInstance.on("player_action", (data: { action: string; time: number }) => {
		console.log("[Socket] Player action received:", data);
		roomState.update((s) => {
			const isPlaying = data.action === "play" ? true : (data.action === "pause" ? false : s.isPlaying);
			return {
				...s,
				isPlaying,
				currentTime: data.time,
				lastUpdated: isPlaying ? Date.now() : 0,
			};
		});
	});
}

export function joinRoom(roomId: string, nickname: string) {
	if (!socketInstance) initSocket();
	socketInstance.emit("join_room", { roomId, nickname });
	localStorage.setItem("nickname", nickname);
	localStorage.setItem("roomId", roomId);
	currentRoomId.set(roomId);
	isJoined.set(true);

	// Update URL without reloading
	const url = new URL(window.location.href);
	url.searchParams.set("room_id", roomId);
	window.history.pushState({}, "", url.toString());
}

export function leaveRoom() {
	isJoined.set(false);
	currentRoomId.set("");
	localStorage.removeItem("roomId");
	window.history.pushState({}, "", "/");
}

export function setUrl(roomId: string, url: string, referer: string) {
	socketInstance.emit("set_url", { roomId, url, referer });
}

export function emitAction(action: string, data: any) {
	socketInstance?.emit(action, data);
}

export function cleanupSocket() {
	if (socketInstance) {
		socketInstance.disconnect();
	}
}
