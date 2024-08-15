const UserModel = require("../models/user");
const MessageModel = require("../models/message");
const RoomModel = require("../models/room");
const ConversationModel = require("../models/conversation");
const moment = require("moment");
const socketMap = new Map();

module.exports = (io, app) => {
  io.on("connection", async (socket) => {
    console.log("a user connected: ", socket.id);

    socket.on("refresh_sid", async (userIdentifier, newSocketId) => {
      try {
        await UserModel.updateOne(
          { _id: userIdentifier },
          { socketId: newSocketId }
        );
        // console.log(
        //   `${socket.id} - server socket`,
        //   `${newSocketId} - newSocketId from client`
        // );

        // Update the socketMap
        socketMap.delete(socket.id);
        socketMap.set(newSocketId, socket);
        // console.log(`Updated socketMap with new ID: ${newSocketId}`);
      } catch (err) {
        console.error("Error updating socket ID:", err);
      }
    });

    // socketMap.set(socket.id, socket);

    socket.on("communicated_people", async (data) => {
      const { userId } = data;
      try {
        const conversations = await ConversationModel.find({
          participants: { $in: [userId] },
          room: null,
        })
          .populate(
            "participants",
            "-bio -password -contacts -rooms -updatedAt -createdAt"
          )
          .populate(
            "messages",
            "sender receiver content delivered replyTo date"
          )
          .lean();

        for (let conversation of conversations) {
          const otherParticipants = conversation.participants.filter(
            (p) => p._id != userId
          );
          const otherParticipant = otherParticipants[0];
          const unreadMessagesCount = conversation?.messages?.reduce(
            (acc, currentMessage) =>
              currentMessage?.delivered == false &&
              currentMessage.receiver == userId
                ? (acc += 1)
                : (acc += 0),
            0
          );

          if (otherParticipant) {
            // Flatten participant fields into the main object
            // conversation.userId = otherParticipant._id;
            conversation.convId = conversation._id;
            conversation._id = otherParticipant._id;
            conversation.firstname = otherParticipant.firstname;
            conversation.username = otherParticipant.username;
            conversation.socketId = otherParticipant.socketId;
            conversation.unreadCount = unreadMessagesCount;
          }

          delete conversation.participants;
        }
console.log(conversations, '- conversationssssss');
        io.to(socket.id).emit("communicated_people", { conversations });
      } catch (err) {
        console.error(`Error handling communicated_chats:`, err);
      }
    });

    socket.on("communicated_rooms", async (data) => {
      const { userId } = data;
      try {
        const conversations = await ConversationModel.find({
          participants: { $in: [userId] },
          room: { $ne: null },
        })
          // .populate("participants", "-bio -password -contacts -rooms")
          .select("-participants -messages")
          .populate("room", "-desc -password -messages -creator");

        io.to(socket.id).emit("communicated_rooms", { conversations });
      } catch (err) {
        console.error(`Error handling communicated_rooms:`, err);
      }
    });

    socket.on("all_rooms", async (data) => {
      try {
        const { senderId } = data;
        const allRooms = await RoomModel.find({
          members: { $in: [senderId] },
        }).select("-desc -password -creator -createdAt");

        for (const room of allRooms) {
          if (Array.isArray(room.messages) && room.messages.length !== 0) {
            // Directly get the last message document
            const lastMessage = await MessageModel.findById(
              room.messages[room.messages.length - 1]
            ).select("sender content delivered date updatedAt");

            if (lastMessage) {
              room["lastMessage"] = {
                ...lastMessage.toObject(),
                isMe: lastMessage.sender == senderId,
              };
            }
          }
        }

        const populatedRooms = await RoomModel.populate(allRooms, [
          { path: "members", select: "firstname username" },
          { path: "messages", select: "content delivered date" },
        ]);

        io.to(socket.id).emit("all_rooms", {
          rooms: populatedRooms,
        });
      } catch (error) {
        console.error("Error processing all_rooms event:", error);
      }
    });

    socket.on("private_message", async (data, cb) => {
      // console.log("private_message event received:", data);
      const { senderId, receiverId, message, replyToMessageId } = data;

      if (
        senderId.trim() === "" ||
        !senderId ||
        receiverId.trim() === "" ||
        !receiverId
      ) {
        return cb({ error: "Sender or receiver identifiers required !" });
      }

      // Trim message content to avoid sending empty messages
      if (message.trim() === "") {
        return cb({ error: "Content required!" });
      }

      try {
        // Find the user by ID
        const user = await UserModel.findById(senderId);
        const receiver = await UserModel.findById(receiverId);

        if (!user || !receiver) {
          return cb({ error: "Whether sender or receiver not found !" });
        }

        // Update user's socket ID
        user.socketId = socket.id;
        await user.save();

        // Find or create a conversation between the two users
        let conversation = await ConversationModel.findOne({
          participants: { $all: [senderId, receiverId] },
          room: null,
        });
        // Create new message object
        const newMessage = new MessageModel({
          sender: senderId,
          receiver: receiverId,
          content: message,
          replyTo: replyToMessageId ? replyToMessageId : null,
          delivered: false,
          date: moment().format("YYYY-MM-DD HH:mm"),
        });

        if (conversation) {
          const amIInChat = conversation.inChat.some((u) => u == senderId);

          if (!amIInChat) {
            conversation.inChat.push(senderId);
          }

          const isOtherUserInChat = conversation.inChat.some(
            (u) => u != senderId
          );

          if (isOtherUserInChat) {
            newMessage.delivered = true;
          }

          await newMessage.save();
          // Add the new message to the conversation
          conversation.messages.push(newMessage._id);
          await conversation.save();

          // Check if the socket is already in the room
          if (!socket.rooms.has(conversation._id.toString())) {
            // Add the socket to the room
            socket.join(conversation._id.toString());
          }

          // Emit the message to the room
          io.to(conversation._id.toString()).emit("private_message", {
            ...newMessage.toObject(),
            date: newMessage.date.split(" ")[1],
            convId: conversation._id,
          });
        } else {
          // Create a new conversation if one doesn't exist
          conversation = new ConversationModel({
            participants: [senderId, receiverId],
            messages: [newMessage._id],
            room: null,
          });

          const amIInChat = conversation.inChat.some((u) => u == senderId);

          if (!amIInChat) {
            conversation.inChat.push(senderId);
          }

          await conversation.save();

          const isOtherUserInChat = conversation.inChat.some(
            (u) => u != senderId
          );

          if (isOtherUserInChat) {
            newMessage.delivered = true;
          }

          await newMessage.save();

          // Check if the socket is already in the room
          if (!socket.rooms.has(conversation._id.toString())) {
            // Add the socket to the room
            socket.join(conversation._id.toString());
          }

          // Emit the message to the new room
          io.to(conversation._id.toString()).emit("private_message", {
            ...newMessage.toObject(),
            date: newMessage.date.split(" ")[1],
            convId: conversation._id,
          });
        }
        // console.log(socket.rooms, "- socket rooms on private_message");

        // Optionally call the callback to acknowledge message reception
        // if (cb) cb({ success: true });
      } catch (err) {
        console.error("Error handling private_message:", err);
        cb && cb({ error: "Failed to handle private_message" });
      }
    });

    // socket.on("room_chat_messages", async (data, cb) => {
    //   console.log(data, "- data on room_chat_messages");
    //   const { senderId, roomId, message, replyToMessageId } = data;
    //   try {
    //     if (message.trim() === "") {
    //       cb({ error: `Content required !` });
    //     }

    //     const room = await RoomModel.findById(roomId);
    //     let populatedMessage;

    //     if (room) {
    //       const newMessage = new MessageModel({
    //         sender: senderId,
    //         room: roomId,
    //         content: message,
    //         replyTo: replyToMessageId && replyToMessageId,
    //         date: moment().format("YYYY-MM-DD HH:mm"),
    //       });

    //       await newMessage.save();

    //       let conversation = await ConversationModel.findOne({
    //         room: roomId,
    //       });

    //       if (!conversation) {
    //         conversation = new ConversationModel({
    //           participants: [senderId],
    //           room: roomId,
    //           messages: [newMessage.id],
    //         });
    //         await conversation.save();
    //       } else {
    //         conversation.messages.push(newMessage.id);
    //         await conversation.save();
    //       }

    //       populatedMessage = await MessageModel.populate(newMessage, [
    //         {
    //           path: "replyTo",
    //           select: "content delivered updatedAt createdAt",
    //         },
    //         {
    //           path: "sender",
    //           select: "firstname username img",
    //         },
    //       ]);

    //       // io.emit("room_chat_messages", {
    //       //   ...newMessage,
    //       //   date: newMessage.date.split(" ")[1],
    //       //   isCurrentUser: true,
    //       // });

    //       // Notify all users in the room about the new message

    //       // io.to(roomId).emit("room_chat_messages", {
    //       //   ...newMessage.toObject(),
    //       //   date: newMessage.date.split(" ")[1],
    //       //   // isCurrentUser: false,
    //       // });

    //       io.to(conversation._id.toString()).emit("room_chat_messages", {
    //         ...populatedMessage.toObject(),
    //         date: populatedMessage.date.split(" ")[1],
    //         // sender: senderId,
    //       });
    //     } else {
    //       cb && cb({ error: "Room not found !" });
    //     }
    //   } catch (err) {
    //     console.error(`Error handling room_chat_messages:`, err);
    //     cb && cb({ error: "Failed to handle room_chat_messages" });
    //   }
    // });

    // socket.on("room_details", async (data, cb) => {
    //   const { senderId, roomId, roomPassword, isJoin } = data;
    //   try {
    //     if (!senderId || !roomId) {
    //       throw new Error(`User and room identifiers required ! `);
    //     }
    //     const user = await UserModel.findById(senderId);
    //     const room = await RoomModel.findById(roomId);
    //     const conversation = await ConversationModel.findOne({ room: roomId })
    //       .populate({
    //         path: "participants",
    //         select: "firstname username img updatedAt",
    //       })
    //       .populate({
    //         path: "messages",
    //         populate: {
    //           path: "sender",
    //           model: "user",
    //           select: "firstname username img updatedAt",
    //         },
    //         select: "-room",
    //       })
    //       .populate({
    //         path: "room",
    //         populate: {
    //           path: "members",
    //           model: "user",
    //           select: "firstname username img updatedAt",
    //         },
    //         select: "-messages",
    //       });
    //     const conversationPlain = conversation.toObject();

    //     if (!user || !conversation || !room) {
    //       throw new Error(
    //         `Whether user or conversation or room credentials not found ! `
    //       );
    //     }

    //     const amIMember = conversationPlain.participants.some(
    //       (p) => p._id == senderId
    //     );

    //     let messagesCopy = [];
    //     let payload = {};

    //     if (conversationPlain?.messages.length !== 0) {
    //       for (const message of conversationPlain.messages) {
    //         const messageObj = message.toObject ? message.toObject() : message;

    //         messageObj.date = messageObj.date.split(" ")[1];
    //         messagesCopy.push(messageObj);
    //       }
    //     }

    //     if (!amIMember) {
    //       if (!room?.isPublic) {
    //         payload = {
    //           roomDetails: {
    //             ...conversationPlain,
    //             messages: [],
    //             isMember: amIMember,
    //           },
    //         };
    //       } else if (room?.isPublic && !("isJoin" in data)) {
    //         payload = {
    //           roomDetails: {
    //             ...conversationPlain,
    //             messages: messagesCopy,
    //             isMember: amIMember,
    //           },
    //         };
    //       }
    //       if (isJoin == true) {
    //         if (
    //           !roomPassword ||
    //           roomPassword != conversationPlain.room.password
    //         ) {
    //           throw new Error(`Matching password required !`);
    //         } else {
    //           socket.join(conversationPlain._id.toString());
    //           conversation.participants.push(user._id);
    //           room.members.push(user._id);
    //           await conversation.save();
    //           await room.save();
    //           payload = {
    //             roomDetails: {
    //               ...conversationPlain,
    //               messages: messagesCopy,
    //               isMember: true,
    //             },
    //             // info: `${
    //             //   user.firstname ? user.firstname : user.username
    //             // }'s joined`,
    //           };
    //         }
    //       } else if (isJoin == false) {
    //         throw new Error(
    //           `Invalid command. The command you attempted is not recognized or supported by the server.`
    //         );
    //       }
    //     } else {
    //       if (!room.isPublic) {
    //         if (!("isJoin" in data)) {
    //           payload = {
    //             roomDetails: {
    //               ...conversationPlain,
    //               messages: messagesCopy,
    //               isMember: true,
    //             },
    //           };
    //         }
    //         if (isJoin == false) {
    //           socket.leave(conversationPlain._id.toString());
    //           room.members.pull(senderId);
    //           conversation.participants.pull(senderId);
    //           await room.save();
    //           await conversation.save();
    //           payload = {
    //             roomDetails: {
    //               ...conversationPlain,
    //               messages: [],
    //               isMember: false,
    //             },
    //             // info: `${user.firstname ? user.firstname : user.username}'s left`,
    //           };
    //         } else if (isJoin == true) {
    //           throw new Error(
    //             `Invalid command. The command you attempted is not recognized or supported by the server.`
    //           );
    //         }
    //       } else {
    //         if (!("isJoin" in data)) {
    //           payload = {
    //             roomDetails: {
    //               ...conversationPlain,
    //               messages: messagesCopy,
    //               isMember: amIMember,
    //             },
    //           };
    //         }
    //         if (isJoin == false) {
    //           socket.leave(conversationPlain._id.toString());
    //           room.members.pull(senderId);
    //           conversation.participants.pull(senderId);
    //           await room.save();
    //           await conversation.save();
    //           payload = {
    //             roomDetails: {
    //               ...conversationPlain,
    //               messages: messagesCopy,
    //               isMember: false,
    //             },
    //             // info: `${user.firstname ? user.firstname : user.username}'s left`,
    //           };
    //         } else if (isJoin == true) {
    //           throw new Error(
    //             `Invalid command. The command you attempted is not recognized or supported by the server.`
    //           );
    //         }
    //       }
    //     }

    //     if ("isJoin" in data && isJoin == true) {
    //       io.to(conversationPlain._id.toString()).emit("room_details", {
    //         info: `${user.firstname ? user.firstname : user.username}'s joined`,
    //       });
    //     } else if ("isJoin" in data && isJoin == false) {
    //       io.to(conversationPlain._id.toString()).emit("room_details", {
    //         info: `${user.firstname ? user.firstname : user.username}'s left`,
    //       });
    //     }

    //     io.to(socket.id).emit("room_details", payload);
    //   } catch (err) {
    //     console.error(`Error handling room_details:`, err);
    //     cb && cb({ error: err });
    //   }
    // });

    socket.on("room_chat_messages", async (data, cb) => {
      // console.log(data, "- data on room_chat_messages");
      const { senderId, roomId, message, replyToMessageId } = data;
      try {
        if (
          senderId.trim() === "" ||
          !senderId ||
          roomId.trim() === "" ||
          !roomId
        ) {
          return cb({ error: "Sender or room identifiers required !" });
        }

        if (message.trim() === "") {
          cb({ error: `Content required !` });
        }

        const room = await RoomModel.findById(roomId);
        let populatedMessage;

        if (room) {
          const newMessage = new MessageModel({
            sender: senderId,
            room: roomId,
            content: message,
            replyTo: replyToMessageId && replyToMessageId,
            date: moment().format("YYYY-MM-DD HH:mm"),
          });

          await newMessage.save();

          let conversation = await ConversationModel.findOne({
            room: roomId,
          });

          if (!conversation) {
            conversation = new ConversationModel({
              participants: [senderId],
              room: roomId,
              messages: [newMessage._id],
            });
            await conversation.save();
          } else {
            conversation.messages.push(newMessage._id);
            await conversation.save();
          }

          populatedMessage = await MessageModel.populate(newMessage, [
            {
              path: "replyTo",
              select: "content delivered updatedAt createdAt",
            },
            {
              path: "sender",
              select: "firstname username img",
            },
          ]);

          // io.emit("room_chat_messages", {
          //   ...newMessage,
          //   date: newMessage.date.split(" ")[1],
          //   isCurrentUser: true,
          // });

          // Notify all users in the room about the new message

          // io.to(roomId).emit("room_chat_messages", {
          //   ...newMessage.toObject(),
          //   date: newMessage.date.split(" ")[1],
          //   // isCurrentUser: false,
          // });

          io.to(conversation._id.toString()).emit("room_chat_messages", {
            ...populatedMessage.toObject(),
            date: populatedMessage.date.split(" ")[1],
            // sender: senderId,
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
      const { senderId, roomId, roomPassword, isJoin } = data;
      try {
        if (!senderId || !roomId) {
          throw new Error(`User and room identifiers required ! `);
        }
        const user = await UserModel.findById(senderId);
        const room = await RoomModel.findById(roomId);
        const conversation = await ConversationModel.findOne({ room: roomId })
          .populate({
            path: "participants",
            select: "firstname username img updatedAt",
          })
          .populate({
            path: "messages",
            populate: {
              path: "sender",
              model: "user",
              select: "firstname username img updatedAt",
            },
            select: "-room",
          })
          .populate({
            path: "room",
            populate: {
              path: "members",
              model: "user",
              select: "firstname username img updatedAt",
            },
            select: "-messages",
          });
        const conversationPlain = conversation.toObject();

        if (!user || !conversation || !room) {
          throw new Error(
            `Whether user or conversation or room credentials not found ! `
          );
        }

        const amIMember = conversationPlain.participants.some(
          (p) => p._id == senderId
        );

        let messagesCopy = [];
        let payload = {};

        if (conversationPlain?.messages.length !== 0) {
          for (const message of conversationPlain.messages) {
            const messageObj = message.toObject ? message.toObject() : message;

            messageObj.date = messageObj.date.split(" ")[1];
            messagesCopy.push(messageObj);
          }
        }

        if (!amIMember) {
          if (!room?.isPublic) {
            payload = {
              roomDetails: {
                ...conversationPlain,
                messages: [],
                isMember: amIMember,
              },
            };
          } else if (room?.isPublic && !("isJoin" in data)) {
            payload = {
              roomDetails: {
                ...conversationPlain,
                messages: messagesCopy,
                isMember: amIMember,
              },
            };
          }
          if (isJoin == true) {
            if (
              !roomPassword ||
              roomPassword != conversationPlain.room.password
            ) {
              throw new Error(`Matching password required !`);
            } else {
              socket.join(conversationPlain._id.toString());
              conversation.participants.push(user._id);
              room.members.push(user._id);
              await conversation.save();
              await room.save();
              payload = {
                roomDetails: {
                  ...conversationPlain,
                  messages: messagesCopy,
                  isMember: true,
                },
                // info: `${
                //   user.firstname ? user.firstname : user.username
                // }'s joined`,
              };
            }
          } else if (isJoin == false) {
            throw new Error(
              `Invalid command. The command you attempted is not recognized or supported by the server.`
            );
          }
        } else {
          if (!room.isPublic) {
            if (!("isJoin" in data)) {
              payload = {
                roomDetails: {
                  ...conversationPlain,
                  messages: messagesCopy,
                  isMember: true,
                },
              };
            }
            if (isJoin == false) {
              socket.leave(conversationPlain._id.toString());
              room.members.pull(senderId);
              conversation.participants.pull(senderId);
              await room.save();
              await conversation.save();
              payload = {
                roomDetails: {
                  ...conversationPlain,
                  messages: [],
                  isMember: false,
                },
                // info: `${user.firstname ? user.firstname : user.username}'s left`,
              };
            } else if (isJoin == true) {
              throw new Error(
                `Invalid command. The command you attempted is not recognized or supported by the server.`
              );
            }
          } else {
            if (!("isJoin" in data)) {
              payload = {
                roomDetails: {
                  ...conversationPlain,
                  messages: messagesCopy,
                  isMember: amIMember,
                },
              };
            }
            if (isJoin == false) {
              socket.leave(conversationPlain._id.toString());
              room.members.pull(senderId);
              conversation.participants.pull(senderId);
              await room.save();
              await conversation.save();
              payload = {
                roomDetails: {
                  ...conversationPlain,
                  messages: messagesCopy,
                  isMember: false,
                },
                // info: `${user.firstname ? user.firstname : user.username}'s left`,
              };
            } else if (isJoin == true) {
              throw new Error(
                `Invalid command. The command you attempted is not recognized or supported by the server.`
              );
            }
          }
        }

        if ("isJoin" in data && isJoin == true) {
          io.to(conversationPlain._id.toString()).emit("room_details", {
            info: `${user.firstname ? user.firstname : user.username}'s joined`,
          });
        } else if ("isJoin" in data && isJoin == false) {
          io.to(conversationPlain._id.toString()).emit("room_details", {
            info: `${user.firstname ? user.firstname : user.username}'s left`,
          });
        }
        // console.log(socket.rooms, "- roomsssssssss");

        io.to(socket.id).emit("room_details", payload);
      } catch (err) {
        console.error(`Error handling room_details:`, err);
        cb && cb({ error: err });
      }
    });

    socket.on("exit_chat", async (data, cb) => {
      const { userId, convId } = data;
      try {
        const conversationId = typeof convId !== "string" && convId.toString();
        socket.leave(conversationId);
        await ConversationModel.updateOne(
          {
            _id: convId,
          },
          { $pull: { inChat: userId } }
        );
      } catch (err) {
        cb && cb({ error: err?.message ? err.message : err });
      }
    });

    socket.on("disconnect", async () => {
      console.log("user disconnected:", socket.id);
      const updatedUser = await UserModel.findOneAndUpdate(
        { socketId: socket.id },
        { socketId: null },
        { new: true }
      );

      if (updatedUser) {
        await ConversationModel.updateMany(
          {
            participants: { $in: [updatedUser._id] },
          },
          { $pull: { inChat: updatedUser._id } }
        );
      }
      socketMap.delete(socket.id);
    });
  });

  app.post("/messages/getchatmessages", async (req, res, next) => {
    const { senderId, receiverId, roomId, socketId } = req.body;
    // let page = 2;
    // let limit = 50;
    try {
      const userSocket = socketMap.get(socketId);

      if (!userSocket) {
        return res.status(400).json({ msg: "Socket not found!" });
      }

      let messages = [];
      let conversationId;

      if (
        senderId.trim() === "" ||
        !senderId ||
        receiverId.trim() === "" ||
        !receiverId
      ) {
        return cb({ error: "Sender or receiver identifiers required !" });
      }

      if (roomId) {
        // room conversation logic
        const conversation = await ConversationModel.findOne({ room: roomId })
          .populate("messages")
          .populate("participants", "firstname username img");

        if (!conversation) {
          return res.status(200).json([]);
        }

        messages = conversation.messages;
        conversationId = conversation._id.toString();

        if (
          conversationId &&
          !userSocket.rooms.has(conversationId.toString())
        ) {
          userSocket.join(conversationId.toString());
          // userSocket.join(conversationId);
        }
      } else if (senderId && receiverId) {
        // one-to-one conversation logic
        const receiver = await UserModel.findById(receiverId);

        if (!receiver) {
          return res.status(400).json({ msg: "Receiver not found!" });
        }

        const conversation = await ConversationModel.findOne({
          participants: { $all: [senderId, receiverId] },
          room: null,
        })
          .populate("messages")
          .lean();

        if (!conversation) {
          return res.status(200).json([]);
        }

        await ConversationModel.updateMany(
          {
            _id: { $ne: conversation._id },
            participants: { $in: [senderId] },
          },
          { $pull: { inChat: senderId } }
        );

        const amIInChat = conversation.inChat.some((u) => u == senderId);

        if (!amIInChat) {
          await ConversationModel.updateOne(
            {
              participants: { $all: [senderId, receiverId] },
              room: null,
            },
            { $push: { inChat: senderId } }
          );
        }

        const existUnreadMessages = conversation.messages.filter(
          (m) => m?.delivered == false && m?.receiver == senderId
        );

        messages = conversation.messages;
        conversationId = conversation._id.toString();

        if (
          Array.isArray(existUnreadMessages) &&
          existUnreadMessages.length !== 0
        ) {
          const unreadMessageIds = existUnreadMessages.map((m) => m?._id);

          await MessageModel.updateMany(
            {
              _id: { $in: unreadMessageIds },
            },
            { delivered: true }
          );
          io.to(receiver.socketId.toString()).emit("track_deliver_status", {
            isDelivered: true,
            convId: conversationId.toString(),
          });
        }

        // console.log(userSocket.rooms, "- userSocket rooomsss before join");

        // if (
        //   conversationId &&
        //   !userSocket.rooms.has(conversationId.toString())
        // ) {
        //   userSocket.join(conversationId.toString());
        //   }

        const currentRooms = Array.from(userSocket.rooms);

        for (const room of currentRooms) {
          if (room != userSocket.id) {
            userSocket.leave(room);
          }
        }

        userSocket.join(conversationId.toString());
      }

      const annotatedMessages = messages.map((message) => ({
        ...message,
        date: message.date.split(" ")[1],
      }));

      // Paginate the messages
      // const startIndex = (page - 1) * limit;
      // const endIndex = page * limit;
      // const paginatedMessages = annotatedMessages.slice(startIndex, endIndex);
      // const response = {
      //   page,
      //   limit,
      //   totalMessages: annotatedMessages.length,
      //   messages: paginatedMessages,
      // };

      // for Infinite Scrolling with Backward Pagination like a telegram
      // Fetch messages based on anchorMessageId
      // if (anchorMessageId) {
      //   messages = await MessageModel.find({
      //     conversation: conversationId,
      //     _id: { $lt: anchorMessageId }, // Messages older than the anchor
      //   })
      //     .sort({ _id: -1 }) // Sort by descending order of _id (newest first)
      //     .limit(limit)
      //     .lean();
      // } else {
      //   // Initial load, fetch the most recent messages
      //   messages = await MessageModel.find({ conversation: conversationId })
      //     .sort({ _id: -1 })
      //     .limit(limit)
      //     .lean();
      // }

      return res.status(200).json(annotatedMessages);
      // return res.status(200).json(annotatedMessages);
    } catch (err) {
      next(err);
    }
  });

  //   const { senderId, roomId, roomPassword, isJoin, socketId } = req.body;
  //   try {
  //     const userSocket = socketMap.get(socketId);

  //     if (!userSocket) {
  //       return res.status(400).json({ msg: "Socket not found !" });
  //     }
  //     if (!senderId || !roomId) {
  //       return res
  //         .status(400)
  //         .json({ msg: `User and room identifiers required ! ` });
  //     }
  //     const user = await UserModel.findById(senderId);
  //     const room = await RoomModel.findById(roomId);
  //     const conversation = await ConversationModel.findOne({ room: roomId })
  //       .populate({
  //         path: "participants",
  //         select: "firstname username img updatedAt",
  //       })
  //       .populate({
  //         path: "messages",
  //         populate: {
  //           path: "sender",
  //           model: "user",
  //           select: "firstname username img updatedAt",
  //         },
  //         select: "-room",
  //       })
  //       .populate({
  //         path: "room",
  //         populate: {
  //           path: "members",
  //           model: "user",
  //           select: "firstname username img updatedAt",
  //         },
  //         select: "-messages",
  //       });
  //     const conversationPlain = conversation.toObject();

  //     if (!user || !conversation || !room) {
  //       return res.status(404).json({
  //         msg: `Whether user or conversation or room credentials not found !`,
  //       });
  //     }

  //     const amIMember = conversationPlain.participants.some(
  //       (p) => p._id == senderId
  //     );

  //     let messagesCopy = [];
  //     let payload = {};

  //     if (conversationPlain?.messages.length !== 0) {
  //       for (const message of conversationPlain.messages) {
  //         const messageObj = message.toObject ? message.toObject() : message;

  //         messageObj.date = messageObj.date.split(" ")[1];
  //         messagesCopy.push(messageObj);
  //       }
  //     }

  //     if (!amIMember) {
  //       if (!room?.isPublic) {
  //         payload = {
  //           roomDetails: {
  //             ...conversationPlain,
  //             messages: [],
  //             isMember: amIMember,
  //           },
  //         };
  //       } else if (room?.isPublic && !("isJoin" in req.body)) {
  //         payload = {
  //           roomDetails: {
  //             ...conversationPlain,
  //             messages: messagesCopy,
  //             isMember: amIMember,
  //           },
  //         };
  //       }
  //       if (isJoin == true) {
  //         if (
  //           !roomPassword ||
  //           roomPassword != conversationPlain.room.password
  //         ) {
  //           return res
  //             .status(400)
  //             .json({ msg: `Matching password required !` });
  //         } else {
  //           userSocket.join(conversation._id.toString());
  //           conversation.participants.push(user._id);
  //           room.members.push(user._id);
  //           await conversation.save();
  //           await room.save();
  //           payload = {
  //             roomDetails: {
  //               ...conversationPlain,
  //               messages: messagesCopy,
  //               isMember: true,
  //             },
  //           };
  //         }
  //       } else if (isJoin == false) {
  //         return res.status(400).json({
  //           msg: `Invalid command. The command you attempted is not recognized or supported by the server.`,
  //         });
  //       }
  //     } else {
  //       if (!room.isPublic) {
  //         if (!("isJoin" in req.body)) {
  //           payload = {
  //             roomDetails: {
  //               ...conversationPlain,
  //               messages: messagesCopy,
  //               isMember: true,
  //             },
  //           };
  //         }
  //         if (isJoin == false) {
  //           userSocket.leave(conversation._id.toString());
  //           room.members.pull(senderId);
  //           conversation.participants.pull(senderId);
  //           await room.save();
  //           await conversation.save();
  //           payload = {
  //             roomDetails: {
  //               ...conversationPlain,
  //               messages: [],
  //               isMember: false,
  //             },
  //           };
  //         } else if (isJoin == true) {
  //           return res.status(400).json({
  //             msg: `Invalid command. The command you attempted is not recognized or supported by the server.`,
  //           });
  //         }
  //       } else {
  //         if (!("isJoin" in req.body)) {
  //           payload = {
  //             roomDetails: {
  //               ...conversationPlain,
  //               messages: messagesCopy,
  //               isMember: amIMember,
  //             },
  //           };
  //         }
  //         if (isJoin == false) {
  //           userSocket.leave(conversation._id.toString());
  //           room.members.pull(senderId);
  //           conversation.participants.pull(senderId);
  //           await room.save();
  //           await conversation.save();
  //           payload = {
  //             roomDetails: {
  //               ...conversationPlain,
  //               messages: messagesCopy,
  //               isMember: false,
  //             },
  //           };
  //         } else if (isJoin == true) {
  //           return res.status(400).json({
  //             msg: `Invalid command. The command you attempted is not recognized or supported by the server.`,
  //           });
  //         }
  //       }
  //     }

  //     // if ("isJoin" in req.body && isJoin == true) {
  //     //   io.to(conversationPlain._id.toString()).emit("room_chat_messages", {
  //     //     info: `${user.firstname ? user.firstname : user.username}'s joined`,
  //     //   });
  //     // } else if ("isJoin" in req.body && isJoin == false) {
  //     //   io.to(conversationPlain._id.toString()).emit("room_chat_messages", {
  //     //     info: `${user.firstname ? user.firstname : user.username}'s left`,
  //     //   });
  //     // }

  //     // io.to(userSocket.id).emit("room_details", payload);

  //     return res.status(200).json(payload);
  //   } catch (err) {
  //     next(err);
  //   }
  // });

  app.post("/rooms/roomdetails", async (req, res, next) => {
    const { senderId, roomId, roomPassword, isJoin, socketId } = req.body;
    try {
      const userSocket = socketMap.get(socketId);

      if (!userSocket) {
        return res.status(400).json({ msg: "Socket not found !" });
      }
      if (
        !senderId ||
        senderId.trim() === "" ||
        senderId.trim() === "" ||
        !roomId
      ) {
        return res
          .status(400)
          .json({ msg: `User and room identifiers required ! ` });
      }
      const user = await UserModel.findById(senderId);
      const room = await RoomModel.findById(roomId);
      const conversation = await ConversationModel.findOne({ room: roomId })
        .populate({
          path: "participants",
          select: "firstname username img updatedAt",
        })
        .populate({
          path: "messages",
          populate: {
            path: "sender",
            model: "user",
            select: "firstname username img updatedAt",
          },
          select: "-room",
        })
        .populate({
          path: "room",
          populate: {
            path: "members",
            model: "user",
            select: "firstname username img updatedAt",
          },
          select: "-messages",
        });
      const conversationPlain = conversation.toObject();

      if (!user || !conversation || !room) {
        return res.status(404).json({
          msg: `Whether user or conversation or room credentials not found !`,
        });
      }

      const amIMember = conversationPlain.participants.some(
        (p) => p._id == senderId
      );

      let messagesCopy = [];
      let payload = {};

      if (conversationPlain?.messages.length !== 0) {
        for (const message of conversationPlain.messages) {
          const messageObj = message.toObject ? message.toObject() : message;

          messageObj.date = messageObj.date.split(" ")[1];
          messagesCopy.push(messageObj);
        }
      }

      if (!amIMember) {
        if (room?.isPublic == true) {
          if (!("isJoin" in req.body)) {
            payload = {
              roomDetails: {
                ...conversationPlain,
                messages: messagesCopy,
                isMember: false,
              },
            };
          } else if (isJoin == true) {
            const currentRooms = Array.from(userSocket.rooms);

            for (const room of currentRooms) {
              if (room != userSocket.id) {
                userSocket.leave(room);
              }
            }
            userSocket.join(conversation._id.toString());
            conversation.participants.push(user._id);
            room.members.push(user._id);
            await conversation.save();
            await room.save();
            payload = {
              roomDetails: {
                ...conversationPlain,
                messages: messagesCopy,
                isMember: true,
              },
            };
          } else if (isJoin == false) {
            return res.status(400).json({
              msg: `Invalid command. The command you attempted is not recognized or supported by the server.`,
            });
          }
        } else if (room?.isPublic == false) {
          if (!("isJoin" in req.body)) {
            payload = {
              roomDetails: {
                ...conversationPlain,
                messages: [],
                isMember: false,
              },
            };
          } else if (isJoin == true) {
            if (
              !roomPassword ||
              roomPassword != conversationPlain.room.password
            ) {
              return res
                .status(400)
                .json({ msg: `Matching password required !` });
            } else {
              const currentRooms = Array.from(userSocket.rooms);

              for (const room of currentRooms) {
                if (room != userSocket.id) {
                  userSocket.leave(room);
                }
              }
              userSocket.join(conversation._id.toString());
              conversation.participants.push(user._id);
              room.members.push(user._id);
              await conversation.save();
              await room.save();
              payload = {
                roomDetails: {
                  ...conversationPlain,
                  messages: messagesCopy,
                  isMember: true,
                },
              };
            }
          } else if (isJoin == false) {
            return res.status(400).json({
              msg: `Invalid command. The command you attempted is not recognized or supported by the server.`,
            });
          }
        }
      } else {
        if (room.isPublic == false) {
          if (!("isJoin" in req.body)) {
            const currentRooms = Array.from(userSocket.rooms);

            for (const room of currentRooms) {
              if (room != userSocket.id) {
                userSocket.leave(room);
              }
            }
            userSocket.join(conversation._id.toString());
            payload = {
              roomDetails: {
                ...conversationPlain,
                messages: messagesCopy,
                isMember: true,
              },
            };
          } else if (isJoin == false) {
            userSocket.leave(conversation._id.toString());
            room.members.pull(senderId);
            conversation.participants.pull(senderId);
            await room.save();
            await conversation.save();
            payload = {
              roomDetails: {
                ...conversationPlain,
                messages: [],
                isMember: false,
              },
            };
          } else if (isJoin == true) {
            return res.status(400).json({
              msg: `Invalid command. The command you attempted is not recognized or supported by the server.`,
            });
          }
        } else {
          if (!("isJoin" in req.body)) {
            const currentRooms = Array.from(userSocket.rooms);

            for (const room of currentRooms) {
              if (room != userSocket.id) {
                userSocket.leave(room);
              }
            }
            userSocket.join(conversation._id.toString());
            payload = {
              roomDetails: {
                ...conversationPlain,
                messages: messagesCopy,
                isMember: true,
              },
            };
          } else if (isJoin == false) {
            userSocket.leave(conversation._id.toString());
            room.members.pull(senderId);
            conversation.participants.pull(senderId);
            await room.save();
            await conversation.save();
            payload = {
              roomDetails: {
                ...conversationPlain,
                messages: messagesCopy,
                isMember: false,
              },
            };
          } else if (isJoin == true) {
            return res.status(400).json({
              msg: `Invalid command. The command you attempted is not recognized or supported by the server.`,
            });
          }
        }
      }
      // console.log(userSocket.rooms, "- usersocket roomsssss");

      // if ("isJoin" in req.body && isJoin == true) {
      //   io.to(conversation._id.toString()).emit("room_chat_messages", {
      //     info: `${user.firstname ? user.firstname : user.username}'s joined`,
      //   });
      // } else if ("isJoin" in req.body && isJoin == false) {
      //   io.to(conversation._id.toString()).emit("room_chat_messages", {
      //     info: `${user.firstname ? user.firstname : user.username}'s left`,
      //   });
      // }

      // io.to(userSocket.id).emit("room_details", payload);

      return res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });
};

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

// socket.on("all_rooms", async (data) => {
//   const { senderId } = data;
//   const allRooms = await RoomModel.find({
//     members: { $in: [senderId] },
//   }).select("-desc -password -creator -createdAt -updatedAt");

//   for (const room of allRooms) {
//     if (Array.isArray(room.messages) && room.messages.length !== 0) {
//       const lastMessageId = room.messages[room.messages.length - 1];
//       const lastMessage = await MessageModel.findById(lastMessageId).select(
//         "sender content delivered date updatedAt"
//       );

//       allRooms[room]["messages"] = [
//         {
//           ...lastMessage,
//           isMe: lastMessage?.sender == senderId,
//         },
//       ];
//     }
//   }

//   const populatedRooms = await RoomModel.populate(allRooms, [
//     { path: "members", select: "firstname username" },
//     { path: "messages", select: "content" },
//   ]);

//   io.to(socket.id).emit("all_rooms", {
//     rooms: populatedRooms,
//   });
// });

// socket.on("room_details", async (data, cb) => {
//   console.log(data, "- data room_details");
//   const { senderId, roomId, roomPassword, isJoin } = data;
//   try {
//     const user = await UserModel.findById(senderId);
//     let room = await RoomModel.findById(roomId)
//       // .populate("messages")
//       .populate("members");

//     if (room) {
//       socket.join(roomId);
//       let messagesCopy = [];
//       if (room.messages.length !== 0) {
//         for (const message of room.messages) {
//           let messageObj = message.toObject ? message.toObject() : message;

//           messageObj.date = messageObj.date.split(" ")[1];
//           messageObj.isCurrentUser =
//             messageObj.sender.toString() === senderId.toString();

//           messagesCopy.push(messageObj);
//         }
//       }
//       // room.messages = messagesCopy;
//       if (!("isJoin" in data)) {
//         let payload = {
//           roomDetails: {
//             ...room.toObject(),
//             // isMember: room.members.includes(senderId),
//             messages: messagesCopy,
//             isMember: room.members.some((m) => m.id == senderId),
//           },
//         };
//         if (!room.isPublic && !payload.roomDetails.isMember) {
//           payload.roomDetails.messages = [];
//         }
//         io.to(user.socketId).emit("room_details", payload);
//         // io.to(roomId).emit("room_details", payload);
//       } else if (isJoin == true) {
//         if (
//           !room.isPublic &&
//           (!roomPassword || roomPassword != room.password)
//         ) {
//           cb && cb({ error: `Matching password required !` });
//         } else {
//           if (!room.isPublic && roomPassword == room.password) {
//             room.members.push(senderId);
//             await room.save();
//             socket.join(roomId);
//             const joinMessage = {
//               info: `${
//                 user.firstname ? user.firstname : user.username
//               } joined`,
//               roomDetails: {
//                 ...room.toObject(),
//                 // isMember: room.members.includes(senderId),
//                 messages: messagesCopy,
//                 isMember: room.members.some((m) => m.id == senderId),
//               },
//             };
//             io.to(user.socketId).emit("room_details", joinMessage);
//             // io.to(roomId).emit("room_details", joinMessage);
//           } else if (room.isPublic) {
//             room.members.push(senderId);
//             await room.save();
//             // socket.join(roomId);
//             const joinMessage = {
//               info: `${
//                 user.firstname ? user.firstname : user.username
//               } joined`,
//               roomDetails: {
//                 ...room.toObject(),
//                 // isMember: room.members.includes(senderId),
//                 messages: messagesCopy,
//                 isMember: room.members.some((m) => m.id == senderId),
//               },
//             };
//             io.to(user.socketId).emit("room_details", joinMessage);
//             // io.to(roomId).emit("room_details", joinMessage);
//           }
//         }
//       } else if (isJoin == false) {
//         if (room && user) {
//           room.members = room.members.filter((m) => m != senderId);
//           await room.save();
//           socket.leave(roomId);
//           const leaveMessage = {
//             info: `${user.firstname ? user.firstname : user.username} left`,
//             roomDetails: {
//               ...room.toObject(),
//               // isMember: room.members.includes(senderId),
//               messages: messagesCopy,
//               isMember: room.members.some((m) => m.id == senderId),
//             },
//           };
//           io.to(user.socketId).emit("room_details", leaveMessage);
//           // io.to(roomId).emit("room_details", leaveMessage);
//         } else {
//           cb && cb({ error: "Whether room or user not found !" });
//         }
//       }
//     } else {
//       cb && cb({ error: "Room not found !" });
//     }
//   } catch (err) {
//     console.error(`Error handling room_details:`, err);
//     cb && cb({ error: "Failed to handle room_details" });
//   }
// });

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

// socket.on("private_message", async (data, cb) => {
//   console.log("private_message event received:", data);
//   const { senderId, receiverId, message } = data;
//   try {
//     if (message.trim() === "") {
//       cb({ error: "Content required !" });
//     }
//     const user = await UserModel.findById(senderId);

//     user.socketId = socket.id;

//     await user.save();

//     const receiver = await UserModel.findById(receiverId);

//     if (receiver) {
//       const newMessage = new MessageModel({
//         sender: senderId,
//         receiver: receiver._id,
//         content: message,
//         date: moment().format("YYYY-MM-DD HH:mm"),
//       });
//       await newMessage.save();

//       // socket.to(receiver.socketId).emit("receive_message", {
//       //   ...newMessage.toObject(),
//       //   date: newMessage.date.split(" ")[1],
//       // });

//       // io.emit("private_message", {
//       //   ...newMessage.toObject(),
//       //   date: newMessage.date.split(" ")[1],
//       //   isCurrentUser: newMessage.sender.toString() === senderId.toString(),
//       // });

//       // socket.emit("private_message", {
//       //   ...newMessage.toObject(),
//       //   date: newMessage.date.split(" ")[1],
//       //   isCurrentUser: true,
//       // });

//       if (receiver.socketId) {
//         socket.to(receiver.socketId).emit("private_message", {
//           ...newMessage.toObject(),
//           date: newMessage.date.split(" ")[1],
//           isCurrentUser: false,
//         });
//       }

//       // if (typeof cb === "function") {
//       //   cb({
//       //     ...newMessage.toObject(),
//       //     date: newMessage.date.split(" ")[1],
//       //     isCurrentUser: true,
//       //   });
//       // }

//       // if (receiver.socketId) {
//       //   io.to(receiver.socketId).emit("private_message", {
//       //     senderId,
//       //     receiverId: receiver._id,
//       //     content: message,
//       //     date: newMessage.date.split(" ")[1],
//       //   });
//       //   newMessage.delivered = true;
//       //   await newMessage.save();
//       // }
//     }
//   } catch (err) {
//     console.error("Error handling private_message:", err);
//     if (typeof cb === "function") {
//       cb && cb({ error: "Failed to handle private_message" });
//     }
//   }
// });
