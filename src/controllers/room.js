const RoomModel = require("../models/room");

async function add(req, res, next) {
  const { name, desc, creator, members } = req.body;
  try {
    const newRoom = new RoomModel({
      name,
      desc,
      creator,
      password: req.body?.password && req.body?.password,
      members: [...members, creator],
      isPublic: req.body?.isPublic && req.body?.isPublic,
    });

    return res.status(201).json(newRoom);
  } catch (err) {
    next(err);
  }
}

async function getAll(req, res, next) {
  try {
    const allRooms = await RoomModel.find();

    const populatedRooms = await RoomModel.populate(allRooms, [
      { path: "members", select: "firstname username" },
      { path: "messages", select: "content" },
    ]);

    return res.status(200).json(populatedRooms);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  const { userId } = req.query;
  try {
    let specifiedRoom = await RoomModel.findById(req.params.id);

    if (!specifiedRoom) {
      return res.status(400).json({ msg: `Room not found !` });
    }

    if (userId) {
      specifiedRoom = {
        ...specifiedRoom._doc,
        isMember: specifiedRoom.members.includes(userId),
      };
    }

    const populatedRoom = await RoomModel.populate(specifiedRoom, [
      { path: "members", select: "firstname username" },
      { path: "messages", select: "content" },
    ]);

    return res.status(200).json(populatedRoom);
  } catch (err) {
    next(err);
  }
}

async function editOne(req, res, next) {
  try {
    const existRoom = await RoomModel.findById(req.params.id);

    if (!existRoom) {
      return res.status(400).json({ msg: `Room not found !` });
    }

    for (const key of Object.keys(req.body)) {
      if (key == "members") {
        for (const { status, content } of req.body.members) {
          if (status == 1) {
            const foundRoomIndex = existRoom.members.indexOf(content);

            if (foundRoomIndex === -1) {
              existRoom.members.push(content);
            }
          } else if (status == 0) {
            const foundRoomIndex = existRoom.members.indexOf(content);

            if (foundRoomIndex !== -1) {
              existRoom.members.splice(content, 1);
            }
          }
        }
      } else {
        existRoom[key] = req.body[key];
      }
    }

    await existRoom.save();

    const populatedRoom = await RoomModel.populate(existRoom, [
      { path: "members", select: "firstname username" },
      { path: "creator", select: "firstname username" },
      { path: "messages", select: "content" },
    ]);

    return res.status(200).json(populatedRoom);
  } catch (err) {
    next(err);
  }
}

async function deleteOne(req, res, next) {
  try {
    const deletedRoom = await RoomModel.findByIdAndDelete(req.params.id);

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
    const specifiedRoom = await RoomModel.findById(req.params.id).populate(
      "members",
      "firstname username"
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
