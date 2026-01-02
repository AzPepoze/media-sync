import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		allowedHosts: true,
		proxy: {
			// Proxy API requests to backend if needed
		},
	},
});
