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

// --- Actions ---
const SERVER_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
let socketInstance: Socket;

export function initSocket() {
	if (socketInstance) return;

	socketInstance = io(SERVER_URL);
	socket.set(socketInstance);

	socketInstance.on("connect", () => {
		console.log("Connected:", socketInstance.id);
		isConnected.set(true);

		// Auto re-join if we have the info
		const savedRoomId = localStorage.getItem("roomId");
		const savedNickname = localStorage.getItem("nickname");
		if (savedRoomId && savedNickname) {
			console.log("Auto-rejoining room:", savedRoomId);
			socketInstance.emit("join_room", { roomId: savedRoomId, nickname: savedNickname });
			isJoined.set(true);
			currentRoomId.set(savedRoomId);
		}
	});

	socketInstance.on("disconnect", (reason) => {
		console.log("Disconnected:", reason);
		isConnected.set(false);
	});

	socketInstance.on("sync_state", (state: RoomState) => {
		console.log("Sync state received:", state.videoUrl);
		roomState.set(state);
		isVideoChanging.set(false);
	});

	socketInstance.on("video_changing", () => {
		console.log("Video is changing...");
		isVideoChanging.set(true);
	});

	socketInstance.on("room_users", (list: User[]) => {
		users.set(list);
	});

	socketInstance.on("room_buffering", (isBuffering: boolean) => {
		isWaitingForOthers.set(isBuffering);
	});

	socketInstance.on("player_action", (data: { action: string; time: number }) => {
		roomState.update((s) => ({
			...s,
			isPlaying: data.action === "play",
			currentTime: data.time,
			lastUpdated: Date.now(),
		}));
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
