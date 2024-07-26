const router = require("express").Router();
const {
  add,
  getAll,
  getOne,
  editOne,
  deleteOne,
  getRoomMembers,
} = require("../controllers/room");

const {
  validateParams,
  validateBody,
  validateEdit,
} = require("../validations/room");

router.route("/").post(validateBody, add);

router.route("/").get(getAll);

router.route("/:id").get(validateParams, getOne);

router.route("/getroommembers/:id").get(validateParams, getRoomMembers);

router.route("/:id").put(validateParams, validateEdit, editOne);

router.route("/:id").delete(validateParams, deleteOne);

module.exports = router;
