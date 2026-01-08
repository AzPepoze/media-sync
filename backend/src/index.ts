import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import proxyRoutes from "./routes/proxy";
import { registerRoomHandlers } from "./handlers/roomHandler";
import { registerPlayerHandlers } from "./handlers/playerHandler";
import { rooms } from "./store";

const allowedOrigin = process.env.FRONTEND_URL || "*";

const app = express();
app.use(cors({
	origin: allowedOrigin,
}));

app.get("/check-room/:roomId", (req, res) => {
	const { roomId } = req.params;
	const exists = !!rooms[roomId];
	res.json({ exists });
});

app.use("/", proxyRoutes);

const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: allowedOrigin,
		methods: ["GET", "POST"],
	},
	pingInterval: 10000,
	pingTimeout: 20000,
});

io.on("connection", (socket) => {
	console.log(`User connected: ${socket.id}`);

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