export interface Room {
	videoUrl: string | null;
	referer: string | null;
	isPlaying: boolean;
	currentTime: number;
	lastUpdated: number;
	wasPlayingBeforeSeek: boolean;
}

export interface User {
	id: string;
	nickname: string;
	isBuffering: boolean;
}

export interface CachedChunk {
	data: Buffer;
	contentType: string;
	headers: Record<string, string>;
	pendingUsers: Set<string>; // Set of socket IDs that still need to load this chunk
	loadingUsers: Set<string>; // Set of socket IDs currently receiving this chunk
	createdAt: number;
	timeoutId?: NodeJS.Timeout; // Timeout for auto-cleanup
}

export interface CachedMediaSource {
	url: string;
	referer?: string;
	cachedAt: number;
	ttl: number; // Time to live in milliseconds
}
