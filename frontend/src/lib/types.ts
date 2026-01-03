export interface User {
	id: string;
	nickname: string;
	isBuffering: boolean;
}

export interface RoomState {
	videoUrl: string | null;
	referer: string | null;
	isPlaying: boolean;
	currentTime: number;
	lastUpdated: number;
}

export interface PlaylistItem {
	id: string;
	title: string;
	url: string;
	referer?: string;
}

export interface Collection {
	id: string;
	name: string;
	items: PlaylistItem[];
}
