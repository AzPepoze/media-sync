import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import proxyRoutes from "./routes/proxy";
import { registerRoomHandlers } from "./handlers/roomHandler";
import { registerPlayerHandlers } from "./handlers/playerHandler";

const app = express();
app.use(cors());

// Use Routes
app.use("/", proxyRoutes);

const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: "*", // In production, replace with specific client URL
		methods: ["GET", "POST"],
	},
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
