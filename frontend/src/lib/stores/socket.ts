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
	});

	socketInstance.on("disconnect", () => {
		console.log("Disconnected");
		isConnected.set(false);
		isJoined.set(false);
	});

	socketInstance.on("sync_state", (state: RoomState) => {
		roomState.set(state);
	});

	socketInstance.on("url_changed", (data: any) => {
		const url = typeof data === "string" ? data : data.url;
		const referer = typeof data === "object" ? data.referer : "";
		roomState.update((s) => ({ ...s, videoUrl: url, referer: referer }));
	});

	socketInstance.on("room_users", (list: User[]) => {
		users.set(list);
	});

	socketInstance.on("room_buffering", (isBuffering: boolean) => {
		isWaitingForOthers.set(isBuffering);
	});

	// Note: 'player_action' is handled directly in VideoPlayer to avoid store latency
}

export function joinRoom(roomId: string, nickname: string) {
	if (!socketInstance) initSocket();
	socketInstance.emit("join_room", { roomId, nickname });
	localStorage.setItem("nickname", nickname);
	currentRoomId.set(roomId);
	isJoined.set(true);

	// Update URL without reloading
	const url = new URL(window.location.href);
	url.searchParams.set("room_id", roomId);
	window.history.pushState({}, "", url.toString());
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
