const UserModel = require("../models/user");
const { saveFile, unlinkImageToUpdate } = require('../utils/upload')

async function login(req, res, next) {
  try {
    let user = await UserModel.findOne({
      username: req.body.username,
    }).select("-updatedAt -createdAt");

    if (!user) {
      user = new UserModel({
        username: req.body.username,
      });
      await user.save();
    }

    let response = {
      msg: `Successfully accessed ChatSphere !`,
      doc: user.id,
      status: 0,
    };

    if (user.password) {
      if (!req.body.password) {
        response.status = 1;
        delete response.doc;
        delete response.msg;
        return res.status(400).json(response);
      } else if (req.body.password != user.password) {
        return res.status(400).json({ msg: `Matching password required !` });
      }
    }

    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

async function getAll(req, res, next) {
  const { userId, searchTerm } = req.query;
  try {
    let allUsers = [];

    if (searchTerm && userId) {
      allUsers = await UserModel.find({
        $and: [
          { username: new RegExp(searchTerm, "i") },
          { _id: { $ne: userId } },
        ],
      });
    } else if (userId) {
      allUsers = await UserModel.find({ _id: { $ne: userId } });
    } else {
      allUsers = await UserModel.find();
    }

    return res.status(200).json(allUsers);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const specifiedUser = await UserModel.findById(req.params.id);

    if (!specifiedUser) {
      return res.status(400).json({ msg: `User not found !` });
    }

    return res.status(200).json(specifiedUser);
  } catch (err) {
    next(err);
  }
}

async function editOne(req, res, next) {
  try {
    const existUser = await UserModel.findById(req.params.id);

    if (!existUser) {
      return res.status(400).json({ msg: `User not found !` });
    }

    if (req.file) {
      await saveFile(req, res, next)
      await unlinkImageToUpdate(req, existUser, next)
    }

    for (const key of Object.keys(req.body)) {
      if (key == "contacts") {
        for (const { content, status } of req.body.contacts) {
          if (status == 1) {
            const foundContactIndex = existUser?.contacts?.indexOf(content);

            if (foundContactIndex == -1) {
              existUser.contacts.push(content);
            }
          } else if (status == 0) {
            existUser.contacts.splice(content, 1);
          }
        }
      } else if (key == "rooms") {
        for (const { content, status } of req.body.rooms) {
          if (status == 1) {
            const foundContactIndex = existUser?.rooms?.indexOf(content);

            if (foundContactIndex == -1) {
              existUser.rooms.push(content);
            }
          } else if (status == 0) {
            existUser.rooms.splice(content, 1);
          }
        }
      } else {
        existUser[key] = req.body[key];
      }
    }

    await existUser.save();

    return res.status(200).json(existUser);
  } catch (err) {
    next(err);
  }
}

async function deleteOne(req, res, next) {
  try {
    const deletedUser = await UserModel.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(400).json({ msg: `User not found !` });
    }

    return res.status(200).json(deletedUser);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  getAll,
  getOne,
  editOne,
  deleteOne,
};
