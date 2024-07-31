const MessageModel = require("../models/message");
const UserModel = require("../models/user");
const { Types } = require("mongoose");

async function add(req, res, next) {
  try {
    const newMessage = await MessageModel.create(req.body);

    return res.status(201).json(newMessage);
  } catch (err) {
    next(err);
  }
}

async function getAll(req, res, next) {
  try {
    const allMessages = await MessageModel.find();

    const populatedMessages = await MessageModel.populate(allMessages, [
      { path: "sender", select: "firstname username" },
      { path: "receiver", select: "firstname username" },
      { path: "room", select: "name" },
      { path: "replyTo", select: "content" },
    ]);

    return res.status(200).json(populatedMessages);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const specifiedMessage = await MessageModel.findById(req.params.id);

    if (!specifiedMessage) {
      return res.status(400).json({ msg: `Message not found !` });
    }

    const populatedMessage = await MessageModel.populate(specifiedMessage, [
      { path: "sender", select: "firstname username" },
      { path: "receiver", select: "firstname username" },
      { path: "room", select: "name" },
      { path: "replyTo", select: "content" },
    ]);

    return res.status(200).json(populatedMessage);
  } catch (err) {
    next(err);
  }
}

async function editOne(req, res, next) {
  try {
    const modifiedMessage = await MessageModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!modifiedMessage) {
      return res.status(400).json({ msg: `Message not found !` });
    }

    const populatedMessage = await MessageModel.populate(modifiedMessage, [
      { path: "sender", select: "firstname username" },
      { path: "receiver", select: "firstname username" },
      { path: "room", select: "name" },
      { path: "replyTo", select: "content" },
    ]);

    return res.status(200).json(populatedMessage);
  } catch (err) {
    next(err);
  }
}

async function deleteOne(req, res, next) {
  try {
    const deletedMessage = await MessageModel.findByIdAndDelete(req.params.id);

    if (!deletedMessage) {
      return res.status(400).json({ msg: `Message not found !` });
    }

    return res.status(200).json(deletedMessage);
  } catch (err) {
    next(err);
  }
}

async function getChatMessages(req, res, next) {
  const { currentUserId, chatUserId, roomId } = req.query;
  try {
    let messages = [];
    if (roomId) {
      messages = await MessageModel.find({
        $and: [
          { room: roomId },
          {
            room: {
              $ne: null,
            },
          },
        ],
      })
        .populate("sender", "username")
        .populate("receiver", "username")
        .populate("room", "name")
        .sort({ createdAt: 1 });
    } else if (currentUserId && chatUserId) {
      messages = await MessageModel.find({
        $or: [
          { sender: currentUserId, receiver: chatUserId },
          { sender: chatUserId, receiver: currentUserId },
        ],
      })
        .populate("sender", "username")
        .populate("receiver", "username")
        .sort({ createdAt: 1 });
    }

    const annotatedMessages = messages.map((message) => ({
      ...message.toObject(),
      date: message.date.split(" ")[1],
      isCurrentUser: message.sender._id.toString() === currentUserId.toString(),
    }));

    return res.status(200).json(annotatedMessages);
  } catch (err) {
    next(err);
  }
}

async function getCommunicatedUsers(req, res, next) {
  try {
    // Find distinct senders and receivers
    // const sentMessages = await MessageModel.find({ sender: req.params.id }).distinct(
    //   "receiver"
    // );
    // const receivedMessages = await MessageModel.find({
    //   receiver: req.params.id,
    // }).distinct("sender");

    // // Combine and remove duplicates
    // const userIds = [...new Set([...sentMessages, ...receivedMessages])];

    // // Populate user details
    // const users = await UserModel.find(
    //   { _id: { $in: userIds } },
    //   "firstname username"
    // );

    const communicatedUsers = await MessageModel.aggregate([
      {
        $match: {
          $or: [
            { sender: new Types.ObjectId(req.params.id) },
            { receiver: new Types.ObjectId(req.params.id) },
          ],
        },
      },
      {
        $group: {
          _id: null,
          senders: { $addToSet: "$sender" },
          receivers: { $addToSet: "$receiver" },
        },
      },
      {
        $project: {
          _id: 0,
          users: { $setUnion: ["$senders", "$receivers"] },
        },
      },
    ]);

    const userIds = communicatedUsers[0]?.users || [];

    const filteredUserIds = userIds.filter(
      (id) => id.toString() !== req.params.id.toString()
    );

    const users = await UserModel.find(
      { _id: { $in: filteredUserIds } },
      "firstname username"
    );

    return res.status(200).json(users);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  add,
  getAll,
  getOne,
  editOne,
  deleteOne,
  getChatMessages,
  getCommunicatedUsers,
};
