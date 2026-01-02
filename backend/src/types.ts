export interface RoomState {
	videoUrl: string | null;
	referer: string | null;
	isPlaying: boolean;
	currentTime: number;
	lastUpdated: number;
}

export interface User {
	id: string;
	nickname: string;
	isBuffering: boolean;
}
