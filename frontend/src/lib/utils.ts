export function formatTime(s: number) {
	if (isNaN(s)) return "00:00";
	const m = Math.floor(s / 60);
	const sec = Math.floor(s % 60);
	return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
