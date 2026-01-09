import { Room, User, CachedChunk, CachedMediaSource } from "./types";

export const rooms: Record<string, Room> = {};

// Store users by room: { roomID: [User, User...] }
export const roomUsers: Record<string, User[]> = {};

// Cache for resolved media sources per room: { roomId: { originalUrl: CachedMediaSource } }
export const mediaSourceCache: Record<string, Map<string, CachedMediaSource>> = {};

// Store deletion timeouts for empty rooms
export const roomTimeouts: Record<string, NodeJS.Timeout> = {};

// Cache for streaming segments: { roomId: { chunkKey: CachedChunk } }
export const streamCache: Record<string, Record<string, CachedChunk>> = {};

// Get or create room cache
export const getRoomCache = (roomId: string): Record<string, CachedChunk> => {
	if (!streamCache[roomId]) {
		streamCache[roomId] = {};
	}
	return streamCache[roomId];
};

// Cache timeout in milliseconds (30 seconds)
const CACHE_TIMEOUT_MS = 30000;

// Create a new cached chunk with current room users as pending
export const createCachedChunk = (
	roomId: string,
	chunkKey: string,
	data: Buffer,
	contentType: string,
	headers: Record<string, string>,
	requestingSocketId: string
): CachedChunk => {
	const users = roomUsers[roomId] || [];
	const pendingUsers = new Set(users.map((u) => u.id));

	// The requesting user has already loaded it
	pendingUsers.delete(requestingSocketId);

	const chunk: CachedChunk = {
		data,
		contentType,
		headers,
		pendingUsers,
		loadingUsers: new Set(),
		createdAt: Date.now(),
	};

	const roomCacheData = getRoomCache(roomId);
	roomCacheData[chunkKey] = chunk;

	console.log(`[Cache] Chunk ${chunkKey} cached for room ${roomId}, pending: ${pendingUsers.size} users`);

	// If only 1 user in room, delete immediately
	if (pendingUsers.size === 0) {
		delete roomCacheData[chunkKey];
		console.log(`[Cache] Chunk ${chunkKey} removed immediately (single user)`);
	} else {
		// Set timeout to cleanup if users don't load in time
		chunk.timeoutId = setTimeout(() => {
			cleanupChunkIfNotLoading(roomId, chunkKey);
		}, CACHE_TIMEOUT_MS);
	}

	return chunk;
};

// Cleanup chunk if no one is actively loading it
const cleanupChunkIfNotLoading = (roomId: string, chunkKey: string): void => {
	const roomCacheData = streamCache[roomId];
	if (!roomCacheData || !roomCacheData[chunkKey]) return;

	const chunk = roomCacheData[chunkKey];

	// Don't delete if someone is actively loading
	if (chunk.loadingUsers.size > 0) {
		console.log(`[Cache] Chunk ${chunkKey} timeout but ${chunk.loadingUsers.size} users still loading, keeping`);
		// Reschedule timeout
		chunk.timeoutId = setTimeout(() => {
			cleanupChunkIfNotLoading(roomId, chunkKey);
		}, CACHE_TIMEOUT_MS);
		return;
	}

	delete roomCacheData[chunkKey];
	console.log(`[Cache] Chunk ${chunkKey} removed from room ${roomId} (timeout, no active loaders)`);
};

// Mark user as starting to load a chunk (for timeout protection)
export const markChunkLoadingStart = (roomId: string, chunkKey: string, socketId: string): void => {
	const roomCacheData = streamCache[roomId];
	if (!roomCacheData || !roomCacheData[chunkKey]) return;

	const chunk = roomCacheData[chunkKey];
	chunk.loadingUsers.add(socketId);
};

// Mark user as having loaded a chunk, delete if all loaded
export const markChunkLoaded = (roomId: string, chunkKey: string, socketId: string): void => {
	const roomCacheData = streamCache[roomId];
	if (!roomCacheData || !roomCacheData[chunkKey]) return;

	const chunk = roomCacheData[chunkKey];
	chunk.loadingUsers.delete(socketId);
	chunk.pendingUsers.delete(socketId);

	// Delete chunk if all pending users have loaded it and no one is actively loading
	if (chunk.pendingUsers.size === 0 && chunk.loadingUsers.size === 0) {
		if (chunk.timeoutId) clearTimeout(chunk.timeoutId);
		delete roomCacheData[chunkKey];
		console.log(`[Cache] Chunk ${chunkKey} removed from room ${roomId} (all users loaded)`);
	}
};

// Get cached chunk if exists
export const getCachedChunk = (roomId: string, chunkKey: string): CachedChunk | null => {
	const roomCacheData = streamCache[roomId];
	if (!roomCacheData) return null;
	return roomCacheData[chunkKey] || null;
};

// Clean up room cache when room is deleted
export const cleanupRoomCache = (roomId: string): void => {
	if (streamCache[roomId]) {
		const chunkCount = Object.keys(streamCache[roomId]).length;
		delete streamCache[roomId];
		if (chunkCount > 0) {
			console.log(`[Cache] Cleaned up ${chunkCount} chunks for room ${roomId}`);
		}
	}
	// Also clean up media source cache for this room
	if (mediaSourceCache[roomId]) {
		const mediaCount = mediaSourceCache[roomId].size;
		delete mediaSourceCache[roomId];
		if (mediaCount > 0) {
			console.log(`[MediaCache] Cleaned up ${mediaCount} media sources for room ${roomId}`);
		}
	}
};

// Remove user from all pending chunks when they disconnect
export const removeUserFromPendingChunks = (roomId: string, socketId: string): void => {
	const roomCacheData = streamCache[roomId];
	if (!roomCacheData) return;

	const chunksToDelete: string[] = [];

	for (const [chunkKey, chunk] of Object.entries(roomCacheData)) {
		chunk.pendingUsers.delete(socketId);
		chunk.loadingUsers.delete(socketId);
		if (chunk.pendingUsers.size === 0 && chunk.loadingUsers.size === 0) {
			if (chunk.timeoutId) clearTimeout(chunk.timeoutId);
			chunksToDelete.push(chunkKey);
		}
	}

	for (const chunkKey of chunksToDelete) {
		delete roomCacheData[chunkKey];
		console.log(`[Cache] Chunk ${chunkKey} removed (user left, no pending users)`);
	}
};

// Media source cache TTL: 6 hours
const MEDIA_SOURCE_TTL = 6 * 60 * 60 * 1000;

// Get cached media source if valid
export const getCachedMediaSource = (roomId: string, url: string): { url: string; referer?: string } | null => {
	const roomCache = mediaSourceCache[roomId];
	if (!roomCache) return null;

	const cached = roomCache.get(url);
	if (!cached) return null;

	const now = Date.now();
	if (now - cached.cachedAt > cached.ttl) {
		// Cache expired
		roomCache.delete(url);
		console.log(`[MediaCache] Expired cache for room ${roomId}: ${url}`);
		return null;
	}

	console.log(`[MediaCache] Cache hit for room ${roomId}: ${url}`);
	return { url: cached.url, referer: cached.referer };
};

// Cache a resolved media source
export const setCachedMediaSource = (
	roomId: string,
	originalUrl: string,
	resolvedUrl: string,
	referer?: string,
	ttl: number = MEDIA_SOURCE_TTL
): void => {
	if (!mediaSourceCache[roomId]) {
		mediaSourceCache[roomId] = new Map();
	}
	mediaSourceCache[roomId].set(originalUrl, {
		url: resolvedUrl,
		referer,
		cachedAt: Date.now(),
		ttl,
	});
	console.log(`[MediaCache] Cached media source for room ${roomId}: ${originalUrl}`);
};

// Clean up expired media source cache entries
export const cleanupExpiredMediaSources = (): void => {
	const now = Date.now();
	let cleaned = 0;

	for (const [roomId, roomCache] of Object.entries(mediaSourceCache)) {
		for (const [url, cached] of roomCache.entries()) {
			if (now - cached.cachedAt > cached.ttl) {
				roomCache.delete(url);
				cleaned++;
			}
		}
		// Remove empty room caches
		if (roomCache.size === 0) {
			delete mediaSourceCache[roomId];
		}
	}

	if (cleaned > 0) {
		console.log(`[MediaCache] Cleaned up ${cleaned} expired media sources`);
	}
};

// Run cleanup periodically (every hour)
setInterval(cleanupExpiredMediaSources, 60 * 60 * 1000);
