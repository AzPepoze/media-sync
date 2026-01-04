import { Room, User } from "./types";

export const rooms: Record<string, Room> = {};

// Store users by room: { roomID: [User, User...] }
export const roomUsers: Record<string, User[]> = {};

// Store deletion timeouts for empty rooms
export const roomTimeouts: Record<string, NodeJS.Timeout> = {};
