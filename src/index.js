require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { join } = require("path");
const uploadPath = join(__dirname, "./uploads");
const {
  dbConnection,
  portConnection,
} = require("./settings/connection/connect");
const globalErrorHandler = require("./settings/errorHandle/errHandler");
const allRoutes = require("./router");
const server = require("http").createServer(app);
app.use(cors());
const io = require("socket.io")(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["*"],
    methods: ["GET", "POST"],
    credentials: true, // Allow credentials like cookies
  },
  transports: ["websocket", "polling"], // Use WebSocket and HTTP long-polling
  allowEIO3: true, // Allow engine.io v3 clients to connect
});
const sockets = require("./sockets/socket");

app.use(express.static(uploadPath));

app.use(express.static("public"));

app.use(express.json());

portConnection(server);

// Wrap dbConnection in an async IIFE to handle errors
(async () => {
  try {
    await dbConnection();
  } catch (err) {
    // Pass the error to the global error handler
    app.use((req, res, next) => {
      next(err);
    });
  }
})();

sockets(io, app);

app.use("/api", allRoutes);

app.use(globalErrorHandler);
