const UserModel = require("../models/user");

async function register(req, res, next) {
  try {
    const existUser = await UserModel.findOne({
      username: req.body?.username,
    }).select("-updatedAt -createdAt");

    if (existUser) {
      return res.status(400).json({ msg: `Try another username !` });
    }

    const newUser = await UserModel.create(req.body);

    return res
      .status(201)
      .json({ msg: `Welcome to ChatSphere system !`, doc: newUser });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const existUser = await UserModel.findOne({
      username: req.body?.username,
    }).select("-updatedAt -createdAt");

    if (!existUser) {
      return res
        .status(400)
        .json({ msg: `System unable to find your credentials !` });
    }

    return res
      .status(200)
      .json({ msg: `Successfully accessed ChatSphere !`, doc: existUser });
  } catch (err) {
    next(err);
  }
}

// async function accessViaPassword(req, res, next) {
//   try {
//     const existUser = await UserModel.findOne({ username: req.body?.username });

//     if (!existUser) {
//       return res.status(400).json({ msg: `System unable to find your credentials !` });
//     }

//     return res
//       .status(201)
//       .json({ msg: `Successfully accessed ChatSphere !`, doc: existUser });
//   } catch (err) {
//     next(err);
//   }
// }

async function getAll(req, res, next) {
  try {
    const allUsers = await UserModel.find();

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
  register,
  login,
  getAll,
  getOne,
  editOne,
  deleteOne,
};
