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
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
const sockets = require("./sockets/socket");

const corsOptions = {
  origin: "http://localhost:5173/",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.static("public"));

app.use(express.json());

dbConnection();

sockets(io);

app.use("/api", allRoutes);

app.use(globalErrorHandler);

portConnection(server);
