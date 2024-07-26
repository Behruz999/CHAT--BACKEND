require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const {
  dbConnection,
  portConnection,
} = require("./settings/connection/connect");
const globalErrorHandler = require("./settings/errorHandle/errHandler");
const allRoutes = require("./router");
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  origin: process.env.CLIENT_URL,
  methods: ["GET", "POST"],
});
const sockets = require("./sockets/socket");

app.use(cors());

app.use(express.static("public"));

app.use(express.json());

dbConnection();

sockets(io);

app.use("/api", allRoutes);

app.use(globalErrorHandler);

portConnection(server);
