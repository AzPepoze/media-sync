import { RoomState, User } from "./types";

// Store room states
export const rooms: Record<string, RoomState> = {};

// Store users by room: { roomID: [User, User...] }
export const roomUsers: Record<string, User[]> = {};

// Store deletion timeouts for empty rooms
export const roomTimeouts: Record<string, NodeJS.Timeout> = {};
