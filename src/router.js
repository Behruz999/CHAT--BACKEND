const router = require("express").Router();
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/message");
const roomRoutes = require("./routes/room");

router.use("/users", userRoutes);

router.use("/messages", messageRoutes);

router.use("/rooms", roomRoutes);

module.exports = router;
