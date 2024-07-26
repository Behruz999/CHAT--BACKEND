// const UserModel = require("../models/user");
// const MessageModel = require("../models/message");
// const RoomModel = require("../models/room");

// module.exports = (io) => {
//   io.on("connection", (socket) => {
//     console.log("New client connected:", socket.id);

//     socket.on("login", async (username) => {
//       let userCredentials = await UserModel.findOne({ username });
//       if (!userCredentials) {
//         userCredentials = new UserModel({ username });
//         await userCredentials.save();
//       }
//       socket.emit("loginSuccess", {
//         userId: userCredentials._id,
//         username: userCredentials.username,
//       });
//     });

//     socket.on("joinRoom", (data) => {
//       const { username, room } = data;
//       socket.join(room);
//       io.to(room).emit("message", {
//         username: "System",
//         message: `${username} has joined the room.`,
//         room,
//       });
//     });

//     socket.on("disconnect", () => {
//       console.log(`Client disconnected: ${socket.id}`);
//     });

//     socket.on("message", async (data) => {
//       const { currentUserId, chatUserId, roomId, message } = data;
//       // const { userId, username, message, room } = data;
//       const newMessage = new MessageModel({
//         sender: userId,
//         // room,
//         content: message,
//       });
//       await newMessage.save();

//       // if (roomId) {
//       //   const existRoom = await RoomModel.findById(roomId);
//       //   existRoom.messages.push(newMessage._id);
//       //   await existRoom.save();
//       //   io.to(roomId).emit("message", newMessage.content);
//       // } else {
//       //   io.emit("message", newMessage.content);
//       // }

//       let messages = [];
//       if (roomId) {
//         messages = await MessageModel.find({
//           $and: [
//             { room: roomId },
//             {
//               room: {
//                 $ne: null,
//               },
//             },
//           ],
//         })
//           .populate("sender", "username")
//           .populate("receiver", "username")
//           .populate("room", "name")
//           .sort({ createdAt: 1 });
//       } else if (currentUserId && chatUserId) {
//         messages = await MessageModel.find({
//           $or: [
//             { sender: currentUserId, receiver: chatUserId },
//             { sender: chatUserId, receiver: currentUserId },
//           ],
//         })
//           .populate("sender", "username")
//           .populate("receiver", "username")
//           .sort({ createdAt: 1 });
//       }

//       const annotatedMessages = messages.map((message) => ({
//         ...message.toObject(),
//         isCurrentUser:
//           message.sender._id.toString() === currentUserId.toString(),
//       }));

//       io.emit("message", annotatedMessages);
//     });
//   });
// };

const UserModel = require("../models/user");
const MessageModel = require("../models/message");

module.exports = (io) => {
  // io.on("connection", (socket) => {
  //   console.log("New client connected:", socket.id);

  //   socket.on("login", async (username) => {
  //     let userCredentials = await UserModel.findOne({ username });
  //     if (!userCredentials) {
  //       userCredentials = new UserModel({ username });
  //       await userCredentials.save();
  //     }
  //     socket.emit("loginSuccess", {
  //       userId: userCredentials._id,
  //       username: userCredentials.username,
  //     });
  //   });

  //   socket.on("disconnect", () => {
  //     console.log(`Client disconnected: ${socket.id}`);
  //   });

  //   socket.on("message", async (data) => {
  //     const { currentUserId, chatUserId, message } = data;
  //     const newMessage = new MessageModel({
  //       sender: currentUserId,
  //       receiver: chatUserId,
  //       content: message,
  //     });
  //     await newMessage.save();

  //     const messages = await MessageModel.find({
  //       $or: [
  //         { sender: currentUserId, receiver: chatUserId },
  //         { sender: chatUserId, receiver: currentUserId },
  //       ],
  //     })
  //       .populate("sender", "username")
  //       .populate("receiver", "username")
  //       .sort({ createdAt: 1 });

  //     const annotatedMessages = messages.map((msg) => ({
  //       ...msg.toObject(),
  //       isCurrentUser: msg.sender._id.toString() === currentUserId.toString(),
  //     }));

  //     io.to(socket.id).emit("message", annotatedMessages);
  //   });
  // });

  // io.on("connection", async (socket) => {
  //   console.log("a user connected: ", socket.id);

  //   // Handle user login
  //   socket.on("login", async (username, callback) => {
  //     console.log(username);
  //     let user = await UserModel.findOne({ username });
  //     if (!user) {
  //       user = new UserModel({ username });
  //       await user.save();
  //     }
  //     user.socketId = socket.id;
  //     await user.save();

  //     socket.userId = user._id;
  //     callback(user._id);

  //     // Send undelivered messages to the user
  //     const undeliveredMessages = await MessageModel.find({
  //       receiver: user._id,
  //       delivered: false,
  //     });

  //     for (const message of undeliveredMessages) {
  //       io.to(socket.id).emit("private message", {
  //         senderId: message.sender,
  //         receiverId: message.receiver,
  //         content: message.content,
  //         date: message.date,
  //       });

  //       message.delivered = true;
  //       await message.save();
  //     }
  //   });

  //   // Handle sending a message
  //   socket.on("private message", async (data) => {
  //     console.log(data);
  //     const { senderId, receiverId, message } = data;
  //     let messages = [];

  //     // Find receiver
  //     const receiver = await UserModel.findById(receiverId);

  //     if (receiver) {
  //       const newMessage = new MessageModel({
  //         sender: senderId,
  //         receiver: receiver._id,
  //         content: message,
  //       });
  //       await newMessage.save();

  //       if (senderId && receiverId) {
  //         messages = await MessageModel.find({
  //           $or: [
  //             { sender: senderId, receiver: receiverId },
  //             { sender: receiverId, receiver: senderId },
  //           ],
  //         })
  //           .populate("sender", "username")
  //           .populate("receiver", "username")
  //           .sort({ createdAt: 1 });
  //       }

  //       const annotatedMessages = messages.map((message) => ({
  //         ...message.toObject(),
  //         isCurrentUser: message.sender._id.toString() === senderId.toString(),
  //       }));

  //       // Emit message to sender
  //       io.to(socket.id).emit("private message", {
  //         senderId,
  //         receiverId: receiver._id,
  //         content: message,
  //         messages: annotatedMessages,
  //         date: newMessage.date,
  //       });

  //       // Check if receiver is online and emit message
  //       if (receiver.socketId) {
  //         io.to(receiver.socketId).emit("private message", {
  //           senderId,
  //           receiverId: receiver._id,
  //           content: message,
  //           messages: annotatedMessages,
  //           date: newMessage.date,
  //         });
  //         newMessage.delivered = true;
  //         await newMessage.save();
  //       }
  //     }
  //   });

  //   socket.on("disconnect", async () => {
  //     console.log("user disconnected", socket.id);
  //     await UserModel.updateOne({ socketId: socket.id }, { socketId: null });
  //   });
  // });

  io.on("connection", async (socket) => {
    console.log("a user connected: ", socket.id);

    socket.on("login", async (username, callback) => {
      console.log(username);
      let user = await UserModel.findOne({ username });
      if (!user) {
        user = new UserModel({ username });
        await user.save();
      }
      user.socketId = socket.id;
      await user.save();

      socket.userId = user._id;
      callback(user._id);

      const undeliveredMessages = await MessageModel.find({
        receiver: user._id,
        delivered: false,
      });

      for (const message of undeliveredMessages) {
        io.to(socket.id).emit("private message", {
          senderId: message.sender,
          receiverId: message.receiver,
          content: message.content,
          date: message.date.split(" ")[1],
        });

        message.delivered = true;
        await message.save();
      }
    });

    socket.on("get_chat_messages", async (data) => {
      const { senderId, receiverId } = data;
      let messages = [];

      if (senderId && receiverId) {
        messages = await MessageModel.find({
          $or: [
            { sender: senderId, receiver: receiverId },
            { sender: receiverId, receiver: senderId },
          ],
        })
          .populate("sender", "username")
          .populate("receiver", "username")
          .sort({ createdAt: 1 });
      }
      // console.log(senderId, '- senderid on get_chat_messages');
      const annotatedMessages = messages.map((message) => ({
        ...message.toObject(),
        isCurrentUser: message.sender._id.toString() === senderId.toString(),
      }));

      io.to(socket.id).emit("private message", { messages: annotatedMessages });
    });

    socket.on("private message", async (data) => {
      console.log(data, "- data on server private m.");
      const { senderId, receiverId, message } = data;
      // let messages = [];

      const receiver = await UserModel.findById(receiverId);

      if (receiver) {
        const newMessage = new MessageModel({
          sender: senderId,
          receiver: receiver._id,
          content: message,
        });
        await newMessage.save();

        // if (senderId && receiverId) {
        //   messages = await MessageModel.find({
        //     $or: [
        //       { sender: senderId, receiver: receiverId },
        //       { sender: receiverId, receiver: senderId },
        //     ],
        //   })
        //     .populate("sender", "username")
        //     .populate("receiver", "username")
        //     .sort({ createdAt: 1 });
        // }

        // const annotatedMessages = messages.map((message) => ({
        //   ...message.toObject(),
        //   isCurrentUser: message.sender._id.toString() === senderId.toString(),
        // }));

        io.to(socket.id).emit("private message", {
          senderId,
          receiverId: receiver._id,
          content: message,
          // messages: annotatedMessages,
          date: newMessage.date.split(" ")[1],
        });

        if (receiver.socketId) {
          io.to(receiver.socketId).emit("private message", {
            senderId,
            receiverId: receiver._id,
            content: message,
            // messages: annotatedMessages,
            date: newMessage.date.split(" ")[1],
          });
          newMessage.delivered = true;
          await newMessage.save();
        }
      }
    });

    socket.on("disconnect", async () => {
      console.log("user disconnected", socket.id);
      await UserModel.updateOne({ socketId: socket.id }, { socketId: null });
    });
  });
};
