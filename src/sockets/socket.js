const UserModel = require("../models/user");
const MessageModel = require("../models/message");
const RoomModel = require("../models/room");
const moment = require("moment");

module.exports = (io) => {
  io.on("connection", async (socket) => {
    console.log("a user connected: ", socket.id);

    socket.on("refresh_sid", async (userIdentifier, socketId) => {
      await UserModel.updateOne({ _id: userIdentifier }, { socketId });
    });

    // socket.on("login", async (username, callback) => {
    //   console.log("login event received for user:", username);
    //   let user = await UserModel.findOne({ username });
    //   if (!user) {
    //     user = new UserModel({ username });
    //     await user.save();
    //   }
    //   user.socketId = socket.id;
    //   await user.save();

    //   socket.userId = user._id;
    //   callback(user._id);

    //   // const undeliveredMessages = await MessageModel.find({
    //   //   receiver: user._id,
    //   //   delivered: false,
    //   // });

    //   // for (const message of undeliveredMessages) {
    //   //   io.to(socket.id).emit("private_message", {
    //   //     senderId: message.sender,
    //   //     receiverId: message.receiver,
    //   //     content: message.content,
    //   //     date: message.date.split(" ")[1],
    //   //   });

    //   //   message.delivered = true;
    //   //   await message.save();
    //   // }
    // });

    socket.on("all_rooms", async (data) => {
      const { senderId } = data;
      const allRooms = await RoomModel.find({
        members: { $in: [senderId] },
      }).select("-desc -password -creator -createdAt -updatedAt");

      for (const room of allRooms) {
        if (Array.isArray(room.messages) && room.messages.length !== 0) {
          const lastMessage = await MessageModel.findById(
            room.messages.length - 1
          ).select("sender content delivered date updatedAt");

          allRooms[room]["messages"] = [
            {
              ...lastMessage,
              isMe: lastMessage?.sender == senderId,
            },
          ];
        }
      }

      const populatedRooms = await RoomModel.populate(allRooms, [
        { path: "members", select: "firstname username" },
        { path: "messages", select: "content" },
      ]);

      io.to(socket.id).emit("all_rooms", {
        rooms: populatedRooms,
      });
    });

    socket.on("private_message", async (data, cb) => {
      console.log("private_message event received:", data);
      const { senderId, receiverId, message } = data;
      try {
        if (message.trim() === "") {
          cb({ error: "Content required !" });
        }
        const user = await UserModel.findById(senderId);

        user.socketId = socket.id;

        await user.save();

        const receiver = await UserModel.findById(receiverId);

        if (receiver) {
          const newMessage = new MessageModel({
            sender: senderId,
            receiver: receiver._id,
            content: message,
            date: moment().format("YYYY-MM-DD HH:mm"),
          });
          await newMessage.save();

          // socket.to(receiver.socketId).emit("receive_message", {
          //   ...newMessage.toObject(),
          //   date: newMessage.date.split(" ")[1],
          // });

          // io.emit("private_message", {
          //   ...newMessage.toObject(),
          //   date: newMessage.date.split(" ")[1],
          //   isCurrentUser: newMessage.sender.toString() === senderId.toString(),
          // });

          socket.emit("private_message", {
            ...newMessage.toObject(),
            date: newMessage.date.split(" ")[1],
            isCurrentUser: true,
          });

          if (receiver.socketId) {
            socket.to(receiver.socketId).emit("private_message", {
              ...newMessage.toObject(),
              date: newMessage.date.split(" ")[1],
              isCurrentUser: false,
            });
          }

          // if (typeof cb === "function") {
          //   cb({
          //     ...newMessage.toObject(),
          //     date: newMessage.date.split(" ")[1],
          //     isCurrentUser: true,
          //   });
          // }

          // if (receiver.socketId) {
          //   io.to(receiver.socketId).emit("private_message", {
          //     senderId,
          //     receiverId: receiver._id,
          //     content: message,
          //     date: newMessage.date.split(" ")[1],
          //   });
          //   newMessage.delivered = true;
          //   await newMessage.save();
          // }
        }
      } catch (err) {
        console.error("Error handling private_message:", err);
        if (typeof cb === "function") {
          cb && cb({ error: "Failed to handle private_message" });
        }
      }
    });

    socket.on("room_chat_messages", async (data, cb) => {
      console.log(data, "- data on room_chat_messages");
      const { senderId, roomId, message, replyToMessageId } = data;
      try {
        if (message.trim() === "") {
          cb({ error: `Content required !` });
        }

        const room = await RoomModel.findById(roomId);

        if (room) {
          const newMessage = new MessageModel({
            sender: senderId,
            room: roomId,
            content: message,
            replyTo: replyToMessageId && replyToMessageId,
            date: moment().format("YYYY-MM-DD HH:mm"),
          });

          room.messages.push(newMessage._id);
          await room.save();

          // io.emit("room_chat_messages", {
          //   ...newMessage,
          //   date: newMessage.date.split(" ")[1],
          //   isCurrentUser: true,
          // });

          // Notify all users in the room about the new message

          io.to(roomId).emit("room_chat_messages", {
            ...newMessage.toObject(),
            date: newMessage.date.split(" ")[1],
            isCurrentUser: false,
          });

          // Notify the sender specifically with isCurrentUser set to true
          socket.emit("room_chat_messages", {
            ...newMessage.toObject(),
            date: newMessage.date.split(" ")[1],
            isCurrentUser: true,
          });
        } else {
          cb && cb({ error: "Room not found !" });
        }
      } catch (err) {
        console.error(`Error handling room_chat_messages:`, err);
        cb && cb({ error: "Failed to handle room_chat_messages" });
      }
    });

    socket.on("room_details", async (data, cb) => {
      console.log(data);
      const { senderId, roomId, roomPassword, isJoin } = data;
      try {
        const room = await RoomModel.findById(roomId);
        const user = await UserModel.findById(senderId);

        if (room) {
          if (!("isJoin" in data)) {
            let payload = {
              roomDetails: {
                ...room.toObject(),
                isMember: room.members.includes(senderId),
              },
            };
            if (!room.isPublic && !payload.roomDetails.isMember) {
              payload.roomDetails.messages = [];
            }
            io.to(user.socketId).emit("room_details", payload);
            // io.to(roomId).emit("room_details", payload);
          } else if (isJoin == true) {
            if (
              !room.isPublic &&
              (!roomPassword || roomPassword != room.password)
            ) {
              cb && cb({ error: `Matching password required !` });
            } else {
              if (!room.isPublic && roomPassword == room.password) {
                room.members.push(senderId);
                await room.save();
                socket.join(roomId);
                const joinMessage = {
                  info: `${
                    user.firstname ? user.firstname : user.username
                  } joined`,
                  roomDetails: {
                    ...room.toObject(),
                    isMember: room.members.includes(senderId),
                  },
                };
                io.to(user.socketId).emit("room_details", joinMessage);
                // io.to(roomId).emit("room_details", joinMessage);
              } else if (room.isPublic) {
                room.members.push(senderId);
                await room.save();
                socket.join(roomId);
                const joinMessage = {
                  info: `${
                    user.firstname ? user.firstname : user.username
                  } joined`,
                  roomDetails: {
                    ...room.toObject(),
                    isMember: room.members.includes(senderId),
                  },
                };
                io.to(user.socketId).emit("room_details", joinMessage);
                // io.to(roomId).emit("room_details", joinMessage);
              }
            }
          } else if (isJoin == false) {
            if (room && user) {
              room.members = room.members.filter((m) => m != senderId);
              await room.save();
              socket.leave(roomId);
              const leaveMessage = {
                info: `${user.firstname ? user.firstname : user.username} left`,
                roomDetails: {
                  ...room.toObject(),
                  isMember: room.members.includes(senderId),
                },
              };
              io.to(user.socketId).emit("room_details", leaveMessage);
              // io.to(roomId).emit("room_details", leaveMessage);
            } else {
              cb && cb({ error: "Whether room or user not found !" });
            }
          }
        } else {
          cb && cb({ error: "Room not found !" });
        }
      } catch (err) {
        console.error(`Error handling room_details:`, err);
        cb && cb({ error: "Failed to handle room_details" });
      }
    });

    // socket.on("leave_room", async (data, cb) => {
    //   const { senderId, roomId } = data;
    //   try {
    //     const room = await RoomModel.findById(roomId);
    //     const user = await UserModel.findById(senderId);

    //     if (room && user) {
    //       room.members = room.members.filter((m) => {
    //         return m != senderId;
    //       });
    //       await room.save();
    //       socket.leave(roomId);
    //       io.to(roomId).emit("room_chat_messages", {
    //         info: `${user.firstname ? user.firstname : user.username} left`,
    //         roomDetails: {
    //           ...room,
    //           isMember: room.members.includes(senderId),
    //         },
    //       });
    //     } else {
    //       cb && cb({ error: "Whether room or user not found !" });
    //     }
    //   } catch (err) {
    //     console.error(`Error handling join_room:`, err);
    //     cb && cb({ error: "Failed to handle join_room" });
    //   }
    // });

    socket.on("disconnect", async () => {
      console.log("user disconnected:", socket.id);
      await UserModel.updateOne({ socketId: socket.id }, { socketId: null });
    });
  });
};
