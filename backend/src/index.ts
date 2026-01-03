import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import proxyRoutes from "./routes/proxy";
import { registerRoomHandlers } from "./handlers/roomHandler";
import { registerPlayerHandlers } from "./handlers/playerHandler";

const app = express();
app.use(cors());

// Use Routes (Manifest-only proxy)
app.use("/", proxyRoutes);

const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: process.env.FRONTEND_URL || "http://localhost:3000",
		methods: ["GET", "POST"],
	},
	pingInterval: 10000, // Check connection every 10 seconds
	pingTimeout: 20000, // Wait 20 seconds before disconnecting
});

io.on("connection", (socket) => {
	console.log(`User connected: ${socket.id}`);

	// Register Socket Handlers
	registerRoomHandlers(io, socket);
	registerPlayerHandlers(io, socket);

	socket.on("disconnect", () => {
		console.log(`User disconnected: ${socket.id}`);
	});
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
