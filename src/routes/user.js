const router = require("express").Router();
const {
  login,
  getAll,
  getOne,
  editOne,
  deleteOne,
} = require("../controllers/user");

const {
  validateParams,
  validateLogin,
  validateEdit,
} = require("../validations/user");

router.route("/login").post(validateLogin, login);

router.route("/").get(getAll);

router.route("/:id").get(validateParams, getOne);

router.route("/:id").put(validateParams, validateEdit, editOne);

router.route("/:id").delete(validateParams, deleteOne);

module.exports = router;
