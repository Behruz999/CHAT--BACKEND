const RoomModel = require("../models/room");

async function add(req, res, next) {
  try {
    const newRoom = await RoomModel.create(req.body);

    return res.status(201).json(newRoom);
  } catch (err) {
    next(err);
  }
}

async function getAll(req, res, next) {
  try {
    const allRooms = await RoomModel.find();

    const populatedRooms = await RoomModel.populate(allRooms, [
      { path: "members", select: "firstname" },
      { path: "messages", select: "content" },
    ]);

    return res.status(200).json(populatedRooms);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const specifiedRoom = await RoomModel.findById(req.params);

    if (!specifiedRoom) {
      return res.status(400).json({ msg: `Room not found !` });
    }

    const populatedRoom = await RoomModel.populate(specifiedRoom, [
      { path: "members", select: "firstname" },
      { path: "messages", select: "content" },
    ]);

    return res.status(200).json(populatedRoom);
  } catch (err) {
    next(err);
  }
}

async function editOne(req, res, next) {
  try {
    const modifiedRoom = await RoomModel.findByIdAndUpdate(
      req.params,
      req.body,
      { new: true }
    );

    if (!modifiedRoom) {
      return res.status(400).json({ msg: `Room not found !` });
    }

    const populatedRoom = await SellerModel.populate(modifiedRoom, [
      { path: "members", select: "firstname" },
      { path: "messages", select: "content" },
    ]);

    return res.status(200).json(populatedRoom);
  } catch (err) {
    next(err);
  }
}

async function deleteOne(req, res, next) {
  try {
    const deletedRoom = await RoomModel.findByIdAndDelete(req.params);

    if (!deletedRoom) {
      return res.status(400).json({ msg: `Room not found !` });
    }

    return res.status(200).json(deletedRoom);
  } catch (err) {
    next(err);
  }
}

async function getRoomMembers(req, res, next) {
  try {
    const specifiedRoom = await RoomModel.findById(req.params).populate(
      "members"
    );

    if (!specifiedRoom) {
      return res.status(400).json({ msg: `Room not found !` });
    }

    return res.status(200).json(specifiedRoom.members);
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
  getRoomMembers,
};
